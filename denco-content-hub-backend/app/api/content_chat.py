from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_workspace_from_path
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.common import ErrorResponse
from app.schemas.content_chat import (
    ChatHistoryResponse,
    ChatMessageRequest,
    ChatMessageResponse,
)
from app.services.content_chat_service import ContentChatService

router = APIRouter(
    prefix="/workspaces/{workspace_id}/content/{content_id}/chat",
    tags=["Content Chat"],
)


@router.get(
    "",
    response_model=ChatHistoryResponse,
    summary="Get content chat history",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Content not found"},
    },
)
async def get_chat_history(
    content_id: int,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> ChatHistoryResponse:
    """Get chat message history for a content item."""
    workspace, _member = workspace_ctx

    service = ContentChatService(db)
    messages = await service.get_history(workspace.id, content_id)
    return ChatHistoryResponse(messages=[ChatMessageResponse.model_validate(m) for m in messages])


@router.post(
    "",
    summary="Send chat message (SSE streaming)",
    status_code=200,
    responses={
        400: {"model": ErrorResponse, "description": "No content text available"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Content not found"},
    },
)
async def send_chat_message(
    content_id: int,
    body: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Send a message and get AI streaming response about content."""
    workspace, _member = workspace_ctx

    service = ContentChatService(db)
    return StreamingResponse(
        service.stream_chat(workspace.id, content_id, body.message),
        media_type="text/event-stream",
    )
