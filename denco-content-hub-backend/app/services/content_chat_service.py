from __future__ import annotations

import json
from typing import TYPE_CHECKING

import structlog

from app.exceptions import BadRequestException, NotFoundException
from app.repositories.analysis_repository import ContentAnalysisRepository
from app.repositories.content_chat_repository import ContentChatMessageRepository
from app.repositories.content_repository import ContentRepository

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.content_chat_message import ContentChatMessage

logger = structlog.get_logger()


class ContentChatService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.chat_repo = ContentChatMessageRepository(db)
        self.content_repo = ContentRepository(db)
        self.analysis_repo = ContentAnalysisRepository(db)

    async def get_history(self, workspace_id: int, content_id: int) -> list[ContentChatMessage]:
        """Get chat history for a content item."""
        item = await self.content_repo.get_by_workspace_and_id(workspace_id, content_id)
        if not item:
            raise NotFoundException("Content not found")

        return await self.chat_repo.get_history(content_id)

    async def stream_chat(self, workspace_id: int, content_id: int, message: str) -> AsyncIterator[str]:
        """Stream AI chat response about content item."""
        item = await self.content_repo.get_by_workspace_and_id(workspace_id, content_id)
        if not item:
            raise NotFoundException("Content not found")

        # Build source text context
        source_text = ""
        if item.source_type == "youtube_video":
            if item.transcription and item.transcription.text:
                source_text = item.transcription.text
        else:
            if item.extracted_text:
                source_text = item.extracted_text

        if not source_text:
            raise BadRequestException("Content has no text to chat about")

        # Load analysis for extra context
        analysis_context = ""
        analysis = await self.analysis_repo.get_by_content_item_id(content_id)
        if analysis and analysis.status == "completed":
            parts: list[str] = []
            if analysis.summary:
                parts.append(f"Резюме: {analysis.summary}")
            if analysis.theses:
                theses_text = ", ".join(t.get("title", "") for t in analysis.theses)
                parts.append(f"Тезисы: {theses_text}")
            if parts:
                analysis_context = "Анализ контента:\n" + "\n".join(parts)

        # Load chat history
        history = await self.chat_repo.get_history(content_id)

        # Save user message
        await self.chat_repo.create(
            content_item_id=content_id,
            role="user",
            message=message,
        )
        await self.db.flush()

        # Build messages for Claude
        system_prompt = (
            f"Ты помощник для анализа контента. Отвечай на русском языке.\n\nТекст источника:\n{source_text}"
        )
        if analysis_context:
            system_prompt += f"\n\n{analysis_context}"

        messages: list[dict] = [{"role": m.role, "content": m.message} for m in history]
        messages.append({"role": "user", "content": message})

        # Stream response
        async for chunk in self._stream_response(system_prompt, messages, content_id):
            yield chunk

    async def _stream_response(
        self,
        system_prompt: str,
        messages: list[dict],
        content_id: int,
    ) -> AsyncIterator[str]:
        """Call Claude API and stream SSE events."""
        try:
            from anthropic import AsyncAnthropic

            from app.config import settings

            client = AsyncAnthropic(api_key=settings.anthropic_api_key)

            full_response = ""

            async with client.messages.stream(
                model=settings.ai_model,
                max_tokens=4096,
                system=system_prompt,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    full_response += text
                    yield (f"data: {json.dumps({'type': 'token', 'content': text})}\n\n")

            # Save assistant message
            assistant_msg = await self.chat_repo.create(
                content_item_id=content_id,
                role="assistant",
                message=full_response,
            )
            await self.db.commit()

            yield (f"data: {json.dumps({'type': 'done', 'message_id': assistant_msg.id})}\n\n")

        except Exception as exc:
            logger.error(
                "Content chat streaming error",
                content_id=content_id,
                error=str(exc),
            )
            yield (f"data: {json.dumps({'type': 'error', 'detail': 'Ошибка AI сервиса. Попробуйте позже.'})}\n\n")
