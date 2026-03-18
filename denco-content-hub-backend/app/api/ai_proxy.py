"""Thin proxy routes that forward AI chat requests to the AI Chat microservice."""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.dependencies import get_current_user, get_workspace_from_path
from app.integrations import ai_chat_client

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.workspace import Workspace, WorkspaceMember

router = APIRouter(prefix="/workspaces/{workspace_id}/ai", tags=["AI Chat"])


class ProxyChatRequest(BaseModel):
    session_id: int | None = None
    message: str = Field(max_length=10000)
    attachment_ids: list[int] | None = None


@router.post(
    "/chat",
    summary="Stream AI chat response via AI Chat microservice",
    status_code=200,
)
async def chat_stream(
    data: ProxyChatRequest,
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    workspace, _member = workspace_ctx
    scope = {
        "type": "workspace",
        "id": workspace.id,
        "company_id": workspace.company_id,
    }
    local_context = {
        "page_context": {
            "workspace_id": workspace.id,
            "company_id": workspace.company_id,
        },
        "attachment_ids": data.attachment_ids or [],
    }
    return StreamingResponse(
        ai_chat_client.stream(
            user_id=current_user.id,
            message=data.message,
            session_id=data.session_id,
            scope=scope,
            local_context=local_context,
        ),
        media_type="text/event-stream",
    )


@router.get(
    "/sessions",
    summary="List AI chat sessions for workspace",
    status_code=200,
)
async def list_sessions(
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    workspace, _member = workspace_ctx
    return await ai_chat_client.get_sessions(
        user_id=current_user.id,
        scope_id=workspace.id,
        company_id=workspace.company_id,
    )


@router.delete(
    "/sessions/{session_id}",
    summary="Delete AI chat session",
    status_code=204,
)
async def delete_session(
    session_id: int,
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    current_user: User = Depends(get_current_user),
) -> Response:
    _workspace, _member = workspace_ctx
    await ai_chat_client.delete_session(
        user_id=current_user.id,
        session_id=session_id,
    )
    return Response(status_code=204)


@router.get(
    "/sessions/{session_id}/messages",
    summary="Get messages for AI chat session",
    status_code=200,
)
async def get_messages(
    session_id: int,
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    _workspace, _member = workspace_ctx
    return await ai_chat_client.get_messages(
        user_id=current_user.id,
        session_id=session_id,
    )
