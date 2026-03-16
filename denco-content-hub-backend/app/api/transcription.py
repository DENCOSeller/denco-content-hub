from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_workspace_from_path, require_role
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.schemas.common import ErrorResponse
from app.schemas.transcription import TranscriptionResponse
from app.services.transcription_service import TranscriptionService

router = APIRouter(
    prefix="/workspaces/{workspace_id}/content/{content_id}",
    tags=["Transcription"],
)


@router.get(
    "/transcription",
    response_model=TranscriptionResponse,
    status_code=200,
    summary="Get transcription for content",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Content or transcription not found"},
    },
)
async def get_transcription(
    workspace_id: int,
    content_id: int,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> TranscriptionResponse:
    """Get transcription for a content item."""
    service = TranscriptionService(db)
    return await service.get_transcription(workspace_id, content_id)  # type: ignore[return-value]


@router.post(
    "/transcription/retry",
    response_model=TranscriptionResponse,
    status_code=200,
    summary="Retry failed transcription",
    responses={
        400: {"model": ErrorResponse, "description": "Transcription is not in FAILED status"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Content or transcription not found"},
    },
)
async def retry_transcription(
    workspace_id: int,
    content_id: int,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> TranscriptionResponse:
    """Retry a failed transcription."""
    _, member = workspace_ctx
    require_role(member, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR])

    service = TranscriptionService(db)
    return await service.retry_transcription(workspace_id, content_id)  # type: ignore[return-value]
