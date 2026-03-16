from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_workspace_from_path, require_role
from app.models.content_plan_item import PlanItemStatus
from app.models.library_item import Platform
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.schemas.common import ErrorResponse, PaginatedResponse, PaginationParams
from app.schemas.content_plan import (
    ContentPlanItemCreate,
    ContentPlanItemFilters,
    ContentPlanItemResponse,
    ContentPlanItemUpdate,
    ContentPlanMetricsUpdate,
)
from app.services.content_plan_service import ContentPlanService

router = APIRouter(
    prefix="/workspaces/{workspace_id}/content-plan",
    tags=["Content Plan"],
)

WRITE_ROLES = [
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.EDITOR,
    WorkspaceRole.CONTRACTOR,
]


@router.get(
    "",
    response_model=PaginatedResponse[ContentPlanItemResponse],
    summary="List content plan items",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def list_plan_items(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    status_filter: PlanItemStatus | None = Query(default=None, alias="status"),
    platform: Platform | None = Query(default=None),
    assignee_id: int | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[ContentPlanItemResponse]:
    """List content plan items with filters and pagination."""
    workspace, _member = workspace_ctx
    pagination = PaginationParams(page=page, size=size)
    filters = ContentPlanItemFilters(
        date_from=date_from,
        date_to=date_to,
        status=status_filter,
        platform=platform,
        assignee_id=assignee_id,
    )

    service = ContentPlanService(db)
    return await service.get_plan_items(  # type: ignore[return-value]
        workspace_id=workspace.id,
        filters=filters,
        pagination=pagination,
    )


@router.get(
    "/{item_id}",
    response_model=ContentPlanItemResponse,
    summary="Get content plan item",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Content plan item not found"},
    },
)
async def get_plan_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> ContentPlanItemResponse:
    """Get a single content plan item by ID."""
    workspace, _member = workspace_ctx

    service = ContentPlanService(db)
    return await service.get_plan_item(workspace.id, item_id)  # type: ignore[return-value]


@router.post(
    "",
    response_model=ContentPlanItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create content plan item",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Workspace or library item not found"},
        409: {"model": ErrorResponse, "description": "Library item already scheduled"},
    },
)
async def create_plan_item(
    body: ContentPlanItemCreate,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> ContentPlanItemResponse:
    """Create a new content plan item."""
    workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)

    service = ContentPlanService(db)
    item = await service.create_plan_item(
        workspace_id=workspace.id,
        user_id=current_user.id,
        data=body,
    )
    return item  # type: ignore[return-value]


@router.patch(
    "/{item_id}",
    response_model=ContentPlanItemResponse,
    summary="Update content plan item",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Content plan item not found"},
    },
)
async def update_plan_item(
    item_id: int,
    body: ContentPlanItemUpdate,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> ContentPlanItemResponse:
    """Update content plan item fields."""
    workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)

    service = ContentPlanService(db)
    return await service.update_plan_item(  # type: ignore[return-value]
        workspace_id=workspace.id,
        item_id=item_id,
        data=body,
    )


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete content plan item",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Content plan item not found"},
    },
)
async def delete_plan_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft delete a content plan item."""
    workspace, member = workspace_ctx
    require_role(member, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR])

    service = ContentPlanService(db)
    await service.delete_plan_item(workspace.id, item_id)


@router.patch(
    "/{item_id}/publish",
    response_model=ContentPlanItemResponse,
    summary="Mark content plan item as published",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        400: {"model": ErrorResponse, "description": "Invalid status transition"},
        404: {"model": ErrorResponse, "description": "Content plan item not found"},
    },
)
async def publish_plan_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> ContentPlanItemResponse:
    """Mark content plan item as published."""
    workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)

    service = ContentPlanService(db)
    return await service.publish_plan_item(  # type: ignore[return-value]
        workspace_id=workspace.id,
        item_id=item_id,
    )


@router.patch(
    "/{item_id}/metrics",
    response_model=ContentPlanItemResponse,
    summary="Update content plan item metrics",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Content plan item not found"},
    },
)
async def update_plan_item_metrics(
    item_id: int,
    body: ContentPlanMetricsUpdate,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> ContentPlanItemResponse:
    """Update metrics for a published content plan item."""
    workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)

    service = ContentPlanService(db)
    return await service.update_metrics(  # type: ignore[return-value]
        workspace_id=workspace.id,
        item_id=item_id,
        data=body,
    )
