from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_workspace_from_path, require_role
from app.integrations.content_intelligence.schemas import IntelligenceResponse
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.schemas.common import ErrorResponse
from app.services.intelligence_service import IntelligenceService

# ── Reference intelligence ────────────────────────────────────────────

ref_router = APIRouter(
    prefix="/workspaces/{workspace_id}/content/{content_id}/intelligence",
    tags=["Intelligence"],
)


@ref_router.get(
    "",
    response_model=IntelligenceResponse,
    summary="Get content intelligence analysis",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Content or analysis not found"},
    },
)
async def get_reference_intelligence(
    workspace_id: int,
    content_id: int,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> IntelligenceResponse:
    """Get intelligence analysis for a content item."""
    workspace, _member = workspace_ctx
    service = IntelligenceService(db)
    return await service.get_reference_intelligence(workspace.id, content_id)


@ref_router.post(
    "/generate",
    response_model=IntelligenceResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate content intelligence analysis",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Content not found"},
    },
)
async def generate_reference_intelligence(
    workspace_id: int,
    content_id: int,
    force: bool = False,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> IntelligenceResponse:
    """Generate or regenerate intelligence analysis for a content item."""
    workspace, member = workspace_ctx
    require_role(
        member,
        [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.CONTRACTOR],
    )
    service = IntelligenceService(db)
    record = await service.generate_reference_intelligence(workspace.id, content_id, force)
    return IntelligenceResponse.model_validate(record)


# ── Competitor post intelligence ──────────────────────────────────────

comp_router = APIRouter(
    prefix="/workspaces/{workspace_id}/competitors/posts/{post_id}/intelligence",
    tags=["Intelligence"],
)


@comp_router.get(
    "",
    response_model=IntelligenceResponse,
    summary="Get competitor post intelligence analysis",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Post or analysis not found"},
    },
)
async def get_competitor_intelligence(
    workspace_id: int,
    post_id: int,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> IntelligenceResponse:
    """Get intelligence analysis for a competitor post."""
    workspace, _member = workspace_ctx
    service = IntelligenceService(db)
    return await service.get_competitor_intelligence(workspace.id, post_id)


@comp_router.post(
    "/generate",
    response_model=IntelligenceResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate competitor post intelligence analysis",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Competitor post not found"},
    },
)
async def generate_competitor_intelligence(
    workspace_id: int,
    post_id: int,
    force: bool = False,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> IntelligenceResponse:
    """Generate or regenerate intelligence analysis for a competitor post."""
    workspace, member = workspace_ctx
    require_role(
        member,
        [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.CONTRACTOR],
    )
    service = IntelligenceService(db)
    record = await service.generate_competitor_intelligence(workspace.id, post_id, force)
    return IntelligenceResponse.model_validate(record)


# ── Trend item intelligence ──────────────────────────────────────────

trend_router = APIRouter(
    prefix="/workspaces/{workspace_id}/trends/{trend_item_id}/intelligence",
    tags=["Intelligence"],
)


@trend_router.get(
    "",
    response_model=IntelligenceResponse,
    summary="Get trend item intelligence analysis",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Trend item or analysis not found"},
    },
)
async def get_trend_item_intelligence(
    workspace_id: int,
    trend_item_id: int,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> IntelligenceResponse:
    """Get intelligence analysis for a trend item."""
    workspace, _member = workspace_ctx
    service = IntelligenceService(db)
    return await service.get_trend_item_intelligence(workspace.id, trend_item_id)


@trend_router.post(
    "/generate",
    response_model=IntelligenceResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate trend item intelligence analysis",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Trend item not found"},
    },
)
async def generate_trend_item_intelligence(
    workspace_id: int,
    trend_item_id: int,
    force: bool = False,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> IntelligenceResponse:
    """Generate or regenerate intelligence analysis for a trend item."""
    workspace, member = workspace_ctx
    require_role(
        member,
        [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.CONTRACTOR],
    )
    service = IntelligenceService(db)
    record = await service.generate_trend_item_intelligence(workspace.id, trend_item_id, force)
    return IntelligenceResponse.model_validate(record)
