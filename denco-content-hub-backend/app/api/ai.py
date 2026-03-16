from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import StreamingResponse

from app.database import get_db
from app.dependencies import get_current_user, require_platform_owner
from app.schemas.chat import (
    AiSettingsResponse,
    AiSettingsUpdate,
    ChatAttachmentResponse,
    ChatMessageResponse,
    ChatRequest,
    ChatSessionCreate,
    ChatSessionResponse,
)
from app.services import ai_setting_service, attachment_service, chat_service

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.user import User

router = APIRouter(prefix="/ai", tags=["AI Chat"])


@router.post(
    "/chat",
    summary="Stream AI chat response",
    status_code=200,
    responses={429: {"description": "Rate limit exceeded"}},
)
async def chat_stream(
    data: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    return StreamingResponse(
        chat_service.stream_chat(db, data, current_user.id),
        media_type="text/event-stream",
    )


@router.get(
    "/sessions",
    response_model=list[ChatSessionResponse],
    summary="List user chat sessions",
)
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatSessionResponse]:
    return await chat_service.list_sessions(db, current_user.id)


@router.post(
    "/sessions",
    response_model=ChatSessionResponse,
    status_code=201,
    summary="Create chat session",
)
async def create_session(
    data: ChatSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatSessionResponse:
    return await chat_service.create_session(db, data, current_user.id)


@router.get(
    "/sessions/{session_id}/messages",
    response_model=list[ChatMessageResponse],
    summary="Get session messages",
    responses={404: {"description": "Session not found"}},
)
async def get_messages(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatMessageResponse]:
    return await chat_service.get_messages(db, session_id, current_user.id)


@router.delete(
    "/sessions/{session_id}",
    status_code=204,
    summary="Delete chat session",
    responses={404: {"description": "Session not found"}},
)
async def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await chat_service.delete_session(db, session_id, current_user.id)


@router.post(
    "/attachments",
    response_model=ChatAttachmentResponse,
    status_code=201,
    summary="Upload file attachment for AI chat",
    responses={400: {"description": "Invalid file type or size"}},
)
async def upload_attachment(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatAttachmentResponse:
    return await attachment_service.upload_attachment(db, file, current_user.id)


@router.get(
    "/settings",
    response_model=AiSettingsResponse,
    summary="Get AI settings (platform owner)",
)
async def get_settings(
    _owner: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> AiSettingsResponse:
    return await ai_setting_service.get_settings(db)


@router.patch(
    "/settings",
    response_model=AiSettingsResponse,
    summary="Update AI settings (platform owner)",
)
async def update_settings(
    data: AiSettingsUpdate,
    owner: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> AiSettingsResponse:
    return await ai_setting_service.update_settings(db, data, owner.id)
