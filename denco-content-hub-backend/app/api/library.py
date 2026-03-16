from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_workspace_from_path, require_role
from app.models.library_item import (
    Category,
    ContentType,
    LibraryStatus,
    Platform,
)
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.schemas.common import ErrorResponse, PaginatedResponse, PaginationParams
from app.schemas.library import (
    LibraryItemCreate,
    LibraryItemFilters,
    LibraryItemResponse,
    LibraryItemUpdate,
)
from app.services.library_generation_service import LibraryGenerationService
from app.services.library_service import LibraryService

router = APIRouter(
    prefix="/workspaces/{workspace_id}/library",
    tags=["Library"],
)

WRITE_ROLES = [
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.EDITOR,
    WorkspaceRole.CONTRACTOR,
]


@router.post(
    "",
    response_model=LibraryItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create library item",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def create_library_item(
    body: LibraryItemCreate,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> LibraryItemResponse:
    """Create a new library item in the workspace."""
    workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)

    service = LibraryService(db)
    item = await service.create_item(
        workspace_id=workspace.id,
        user_id=current_user.id,
        data=body,
    )
    return item  # type: ignore[return-value]


@router.get(
    "",
    response_model=PaginatedResponse[LibraryItemResponse],
    summary="List library items",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def list_library_items(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    platform: Platform | None = Query(default=None),
    content_type: ContentType | None = Query(default=None),
    category: Category | None = Query(default=None),
    status_filter: LibraryStatus | None = Query(default=None, alias="status"),
    hunt_level: int | None = Query(default=None, ge=1, le=5),
    search: str | None = Query(default=None, max_length=200),
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[LibraryItemResponse]:
    """List library items with filters and pagination."""
    workspace, _member = workspace_ctx
    pagination = PaginationParams(page=page, size=size)
    filters = LibraryItemFilters(
        platform=platform,
        content_type=content_type,
        category=category,
        status=status_filter,
        hunt_level=hunt_level,
        search=search,
    )

    service = LibraryService(db)
    return await service.list_items(  # type: ignore[return-value]
        workspace_id=workspace.id,
        filters=filters,
        pagination=pagination,
    )


@router.get(
    "/{item_id}",
    response_model=LibraryItemResponse,
    summary="Get library item details",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Library item not found"},
    },
)
async def get_library_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> LibraryItemResponse:
    """Get a single library item by ID."""
    workspace, _member = workspace_ctx

    service = LibraryService(db)
    return await service.get_item(workspace.id, item_id)  # type: ignore[return-value]


@router.patch(
    "/{item_id}",
    response_model=LibraryItemResponse,
    summary="Update library item",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Library item not found"},
    },
)
async def update_library_item(
    item_id: int,
    body: LibraryItemUpdate,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> LibraryItemResponse:
    """Update library item fields (edited_content, status, title, source_text)."""
    workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)

    service = LibraryService(db)
    return await service.update_item(  # type: ignore[return-value]
        workspace_id=workspace.id,
        item_id=item_id,
        data=body,
    )


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete library item",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Library item not found"},
    },
)
async def delete_library_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft delete a library item."""
    workspace, member = workspace_ctx
    require_role(member, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR])

    service = LibraryService(db)
    await service.delete_item(workspace.id, item_id)


@router.post(
    "/{item_id}/generate",
    response_model=LibraryItemResponse,
    summary="Generate AI content for library item",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Library item not found"},
    },
)
async def generate_library_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> LibraryItemResponse:
    """Generate or regenerate AI content for a library item."""
    workspace, member = workspace_ctx
    require_role(member, WRITE_ROLES)

    service = LibraryGenerationService(db)
    item = await service.generate(
        workspace_id=workspace.id,
        item_id=item_id,
    )
    return item  # type: ignore[return-value]
