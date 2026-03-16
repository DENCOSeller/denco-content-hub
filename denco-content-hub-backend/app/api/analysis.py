from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_workspace_from_path, require_role
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.schemas.common import ErrorResponse
from app.schemas.content_analysis import ContentAnalysisResponse, GenerateAnalysisRequest
from app.services.analysis_service import ContentAnalysisService

router = APIRouter(
    prefix="/workspaces/{workspace_id}/content/{content_id}/analysis",
    tags=["Analysis"],
)


@router.get(
    "",
    response_model=ContentAnalysisResponse,
    summary="Get content analysis",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Content or analysis not found"},
    },
)
async def get_analysis(
    content_id: int,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> ContentAnalysisResponse:
    """Get analysis for a content item."""
    workspace, _member = workspace_ctx

    service = ContentAnalysisService(db)
    return await service.get_analysis(workspace.id, content_id)  # type: ignore[return-value]


@router.post(
    "/generate",
    response_model=ContentAnalysisResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate content analysis",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Content not found"},
    },
)
async def generate_analysis(
    content_id: int,
    body: GenerateAnalysisRequest,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> ContentAnalysisResponse:
    """Generate or regenerate content analysis."""
    workspace, member = workspace_ctx
    require_role(
        member,
        [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.CONTRACTOR],
    )

    service = ContentAnalysisService(db)
    return await service.generate_analysis(workspace.id, content_id, body.force_regenerate)  # type: ignore[return-value]
