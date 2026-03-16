from __future__ import annotations

import json
import re
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

import structlog

from app.exceptions import BadRequestException, NotFoundException, RateLimitException
from app.models.chat import ChatRole
from app.repositories.chat_repository import (
    ChatAttachmentRepository,
    ChatMessageRepository,
    ChatSessionRepository,
)
from app.repositories.knowledge_edge_repository import KnowledgeEdgeRepository
from app.repositories.knowledge_node_repository import KnowledgeNodeRepository
from app.schemas.chat import (
    ChatMessageResponse,
    ChatRequest,
    ChatSessionCreate,
    ChatSessionResponse,
)
from app.services.ai_setting_service import get_settings
from app.services.attachment_service import build_attachment_blocks
from app.utils.ai_tool_executor import ReadToolExecutor
from app.utils.ai_tools import ALL_TOOLS, READ_TOOL_NAMES, TOOLS_SYSTEM_PROMPT

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.chat import ChatAttachment, ChatMessage
    from app.schemas.chat import AiSettingsResponse

logger = structlog.get_logger()

_NODE_TAG_RE = re.compile(r"\[\[node:\d+:\w+:(.+?)\]\]")


def _strip_node_tags(text: str) -> str:
    """Replace [[node:ID:TYPE:Title]] tags with just the Title."""
    return _NODE_TAG_RE.sub(r"\1", text)


# --- AI Provider ---


async def _stream_anthropic(
    messages: list[dict],
    static_system: str,
    dynamic_context: str,
    model: str,
    tools: list[dict],
    executor: ReadToolExecutor,
    max_tool_rounds: int = 5,
) -> AsyncIterator[dict[str, Any]]:
    from anthropic import AsyncAnthropic

    from app.config import settings

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    system_blocks: list[dict[str, Any]] = [
        {"type": "text", "text": static_system, "cache_control": {"type": "ephemeral"}},
    ]
    if dynamic_context:
        system_blocks.append({"type": "text", "text": dynamic_context})

    base_kwargs: dict[str, Any] = {
        "model": model,
        "max_tokens": 4096,
        "system": system_blocks,
        "tools": tools,
        "tool_choice": {"type": "auto"},
    }

    # --- READ tool loop (non-streaming) ---
    tool_rounds = 0
    loop_messages: list[Any] = list(messages)

    while tool_rounds < max_tool_rounds:
        response = await client.messages.create(**base_kwargs, messages=loop_messages)

        # Collect READ tool calls from response
        read_calls = [b for b in response.content if b.type == "tool_use" and b.name in READ_TOOL_NAMES]
        if not read_calls:
            break  # no READ tools — proceed to streaming

        # Append assistant response + tool results
        loop_messages.append({"role": "assistant", "content": response.content})
        tool_results: list[dict[str, Any]] = []
        for tc in read_calls:
            result = await executor.execute_json(tc.name, tc.input)
            tool_results.append(
                {"type": "tool_result", "tool_use_id": tc.id, "content": result},
            )
            yield {"type": "tool_progress", "tool": tc.name}
        loop_messages.append({"role": "user", "content": tool_results})
        tool_rounds += 1

    # --- Final streaming response ---
    async with client.messages.stream(**base_kwargs, messages=loop_messages) as stream:
        current_tool: dict[str, str] | None = None
        tool_json_parts: list[str] = []

        async for event in stream:
            if event.type == "content_block_start":
                block = event.content_block
                if hasattr(block, "type") and block.type == "tool_use":
                    current_tool = {"id": block.id, "name": block.name}
                    tool_json_parts = []
            elif event.type == "content_block_delta":
                delta = event.delta
                if hasattr(delta, "text"):
                    yield {"type": "text", "content": delta.text}
                elif hasattr(delta, "partial_json"):
                    tool_json_parts.append(delta.partial_json)
            elif event.type == "content_block_stop" and current_tool:
                try:
                    payload = json.loads("".join(tool_json_parts))
                except json.JSONDecodeError:
                    payload = {}
                yield {"type": "tool_use", "name": current_tool["name"], "input": payload}
                current_tool = None


async def _stream_provider(
    ai_settings: AiSettingsResponse,
    messages: list[dict],
    static_system: str,
    dynamic_context: str,
    tools: list[dict],
    executor: ReadToolExecutor,
    max_tool_rounds: int = 5,
) -> AsyncIterator[dict[str, Any]]:
    match ai_settings.ai_provider:
        case "anthropic":
            async for chunk in _stream_anthropic(
                messages,
                static_system,
                dynamic_context,
                ai_settings.ai_model,
                tools,
                executor,
                max_tool_rounds,
            ):
                yield chunk
        case _:
            raise ValueError(f"Unsupported AI provider: {ai_settings.ai_provider}")


# --- Context building ---


# Max total chars for dynamic context (~50k chars ≈ 12k tokens)
_MAX_CONTEXT_CHARS = 50_000


async def _build_workspace_summary(
    db: AsyncSession,
    page_context: dict[str, Any] | None,
) -> str:
    """Build rich context: node map, focused node, related content.

    Supports both workspace and company scoped knowledge graphs.
    """
    if not page_context:
        return ""

    workspace_id = page_context.get("workspace_id")
    company_id = page_context.get("company_id")
    if not workspace_id and not company_id:
        return ""

    node_repo = KnowledgeNodeRepository(db)

    # --- 1. Knowledge map: all nodes as title + type ---
    if workspace_id:
        overview = await node_repo.get_workspace_overview(int(workspace_id))
        scope_label = "workspace"
    else:
        overview = await node_repo.get_company_overview(int(company_id))  # type: ignore[arg-type]
        scope_label = "company"

    lines: list[str] = ["Current page context:"]
    node_list = overview.get("node_list", [])
    if node_list:
        lines.append(f"\n📋 Knowledge map ({len(node_list)} nodes in {scope_label}):")
        for n in node_list:
            lines.append(f'- "{n["title"]}" ({n["type"]})')
    else:
        lines.append(f"\nNo knowledge nodes in {scope_label} yet.")
    lines.append("")

    # --- 2. Focused node: full content ---
    focused_node_ids = page_context.get("focused_node_ids")
    focused_node = None
    if focused_node_ids:
        try:
            focused_node = await node_repo.get_by_id_or_none(int(focused_node_ids[0]))
        except (ValueError, TypeError):
            focused_node = None

    if not focused_node:
        lines.append(
            "Use search_knowledge_nodes and get_node_with_edges tools "
            "to find relevant knowledge. Do NOT guess node content."
        )
        return "\n".join(lines)

    node_title = focused_node.title or "Untitled"
    node_type = str(focused_node.node_type) if focused_node.node_type else "unknown"
    lines.append(f'📌 Focused node: "{node_title}" ({node_type})')

    content_text = getattr(focused_node, "content_text", None)
    if content_text:
        lines.append(f"Content:\n{content_text}\n")
    else:
        lines.append("Content: (empty)\n")

    # --- 3. Related nodes: batch load + content ---
    edge_repo = KnowledgeEdgeRepository(db)
    edges = await edge_repo.get_edges_for_node(focused_node.id)
    related_nodes_data: list[tuple[dict, str]] = []
    if edges:
        connected_ids = [int(e["connected_node_id"]) for e in edges]
        related_nodes = await node_repo.get_by_ids(connected_ids)
        nodes_map = {n.id: n for n in related_nodes}
        for edge in edges:
            node = nodes_map.get(int(edge["connected_node_id"]))
            rel_content = (getattr(node, "content_text", None) or "") if node else ""
            related_nodes_data.append((edge, rel_content))

    if related_nodes_data:
        lines.append(f"🔗 Related nodes ({len(related_nodes_data)}):")

        # Calculate budget for related content
        current_size = sum(len(line) for line in lines)
        budget = max(_MAX_CONTEXT_CHARS - current_size, 2000)
        total_content_len = sum(len(content) for _, content in related_nodes_data)
        need_truncation = total_content_len > budget

        budget_remaining = budget
        for edge, rel_content in related_nodes_data:
            label = edge.get("label", "связь")
            r_title = edge.get("connected_node_title", "?")
            r_type = edge.get("connected_node_type", "?")
            header = f'\n### "{r_title}" ({r_type}) [связь: {label}]'

            if budget_remaining <= 0:
                lines.append(f"{header}\n(контент пропущен — лимит)")
                continue

            if rel_content:
                if need_truncation and total_content_len > 0:
                    share = max(int(budget * len(rel_content) / total_content_len), 200)
                    share = min(share, budget_remaining)
                    if len(rel_content) > share:
                        rel_content = rel_content[:share].rstrip() + "... (обрезано)"
                    budget_remaining -= len(rel_content)
                lines.append(f"{header}\n{rel_content}")
            else:
                lines.append(f"{header}\n(пусто)")
        lines.append("")

    lines.append(
        "You already have the focused node and related nodes content above. "
        "Use search_knowledge_nodes only if you need OTHER nodes not listed here."
    )
    return "\n".join(lines)


def _build_messages(
    history: list[ChatMessage],
    new_message: str,
    attachments: list[ChatAttachment] | None = None,
) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    for msg in history:
        messages.append({"role": str(msg.role), "content": msg.content})

    if attachments:
        content_blocks: list[dict[str, Any]] = build_attachment_blocks(attachments)
        text = new_message.strip() or "Проанализируй прикреплённый файл."
        content_blocks.append({"type": "text", "text": text})
        messages.append({"role": "user", "content": content_blocks})
    else:
        messages.append({"role": "user", "content": new_message})
    return messages


# --- Public API ---


async def check_rate_limit(db: AsyncSession, user_id: int, limit: int) -> None:
    msg_repo = ChatMessageRepository(db)
    since = datetime.now(UTC) - timedelta(hours=1)
    count = await msg_repo.count_user_messages_since(user_id, since)
    if count >= limit:
        raise RateLimitException("AI chat rate limit exceeded")


async def create_session(db: AsyncSession, data: ChatSessionCreate, user_id: int) -> ChatSessionResponse:
    repo = ChatSessionRepository(db)
    session = await repo.create(user_id=user_id, title=data.title, page_context=data.page_context)
    await db.commit()
    logger.info("Chat session created", session_id=session.id, user_id=user_id)
    return ChatSessionResponse.model_validate(session)


async def list_sessions(db: AsyncSession, user_id: int, limit: int = 50) -> list[ChatSessionResponse]:
    repo = ChatSessionRepository(db)
    sessions = await repo.get_user_sessions(user_id, limit)
    return [ChatSessionResponse.model_validate(s) for s in sessions]


async def get_messages(db: AsyncSession, session_id: int, user_id: int, limit: int = 50) -> list[ChatMessageResponse]:
    session_repo = ChatSessionRepository(db)
    session = await session_repo.get_by_id_for_user(session_id, user_id)
    if not session:
        raise NotFoundException("Chat session not found")
    msg_repo = ChatMessageRepository(db)
    messages = await msg_repo.get_session_messages(session_id, limit)
    return [ChatMessageResponse.model_validate(m) for m in messages]


async def delete_session(db: AsyncSession, session_id: int, user_id: int) -> None:
    session_repo = ChatSessionRepository(db)
    session = await session_repo.get_by_id_for_user(session_id, user_id)
    if not session:
        raise NotFoundException("Chat session not found")
    await session_repo.soft_delete(session.id)
    await db.commit()
    logger.info("Chat session deleted", session_id=session_id, user_id=user_id)


async def stream_chat(db: AsyncSession, data: ChatRequest, user_id: int) -> AsyncIterator[str]:
    try:
        if not data.message.strip() and not data.attachment_ids:
            raise BadRequestException("Message or attachments required")

        ai_settings = await get_settings(db)
        await check_rate_limit(db, user_id, ai_settings.ai_rate_limit_per_hour)

        session_repo = ChatSessionRepository(db)
        msg_repo = ChatMessageRepository(db)

        # Get or create session
        if data.session_id:
            session = await session_repo.get_by_id_for_user(data.session_id, user_id)
            if not session:
                raise NotFoundException("Chat session not found")
        else:
            title = data.message[:100] if data.message.strip() else "Файл"
            session = await session_repo.create(user_id=user_id, title=title, page_context=data.page_context)
            await db.flush()

        # Save user message
        user_msg = await msg_repo.create(
            session_id=session.id,
            role=ChatRole.USER,
            content=data.message or "[файл]",
            page_context=data.page_context,
        )
        await db.flush()

        # Link attachments to the user message
        user_attachments: list[ChatAttachment] = []
        if data.attachment_ids:
            att_repo = ChatAttachmentRepository(db)
            user_attachments = await att_repo.get_user_unlinked(data.attachment_ids, user_id)
            for att in user_attachments:
                att.message_id = user_msg.id
            await db.flush()

        # Build system prompt (static + dynamic context)
        static_system = ai_settings.ai_master_prompt + TOOLS_SYSTEM_PROMPT
        dynamic_context = await _build_workspace_summary(db, data.page_context)

        # Build message history
        history = await msg_repo.get_session_messages(session.id, ai_settings.ai_max_history_messages)
        history = [m for m in history if m.id != user_msg.id]
        messages = _build_messages(history, data.message, user_attachments or None)

        # Stream from AI provider (tools always enabled)
        executor = ReadToolExecutor(db, user_id, data.page_context)
        full_response: list[str] = []
        text_buf = ""
        async for chunk in _stream_provider(
            ai_settings,
            messages,
            static_system,
            dynamic_context,
            ALL_TOOLS,
            executor,
        ):
            if chunk["type"] == "text":
                full_response.append(chunk["content"])
                text_buf += chunk["content"]
                # Hold back if buffer may contain an incomplete [[node:...]] tag
                if "[[" in text_buf and "]]" not in text_buf:
                    continue
                cleaned = _strip_node_tags(text_buf)
                if cleaned:
                    yield f"data: {json.dumps({'type': 'token', 'content': cleaned})}\n\n"
                text_buf = ""
            elif chunk["type"] == "tool_use":
                event = {"type": "action", "action_type": chunk["name"], "payload": chunk["input"]}
                yield f"data: {json.dumps(event)}\n\n"
            elif chunk["type"] == "tool_progress":
                yield f"data: {json.dumps({'type': 'tool_progress', 'tool': chunk['tool']})}\n\n"
        # Flush remaining buffer
        if text_buf:
            cleaned = _strip_node_tags(text_buf)
            if cleaned:
                yield f"data: {json.dumps({'type': 'token', 'content': cleaned})}\n\n"

        # Save assistant message (text only, not tool calls)
        assistant_msg = await msg_repo.create(
            session_id=session.id,
            role=ChatRole.ASSISTANT,
            content=_strip_node_tags("".join(full_response)),
        )
        await db.commit()

        yield f"data: {json.dumps({'type': 'done', 'session_id': session.id, 'message_id': assistant_msg.id})}\n\n"

    except BadRequestException as exc:
        yield f"data: {json.dumps({'type': 'error', 'detail': exc.message})}\n\n"
    except RateLimitException as exc:
        yield f"data: {json.dumps({'type': 'error', 'detail': exc.message})}\n\n"
    except NotFoundException as exc:
        yield f"data: {json.dumps({'type': 'error', 'detail': exc.message})}\n\n"
    except Exception as exc:
        logger.exception("Chat stream error", user_id=user_id)
        yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)})}\n\n"
