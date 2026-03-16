from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_workspace_from_path, require_role
from app.models.content_item import SourceType
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.schemas.common import ErrorResponse, PaginatedResponse, PaginationParams
from app.schemas.content import (
    AddContentRequest,
    ContentItemResponse,
    ContentItemShortResponse,
    SourceTypeForm,
)
from app.services.content_service import ContentService

router = APIRouter(
    prefix="/workspaces/{workspace_id}/content",
    tags=["Content"],
)


@router.post(
    "",
    response_model=ContentItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add content by URL",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
        409: {"model": ErrorResponse, "description": "Content already exists"},
    },
)
async def add_content(
    body: AddContentRequest,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> ContentItemResponse:
    """Add content by URL. Parsing is dispatched in background."""
    workspace, member = workspace_ctx
    require_role(
        member,
        [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.CONTRACTOR],
    )

    service = ContentService(db)
    item = await service.add_content(
        workspace_id=workspace.id,
        user_id=current_user.id,
        url=str(body.url),
    )
    return item  # type: ignore[return-value]


@router.post(
    "/source",
    response_model=ContentItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add content from various sources",
    responses={
        400: {"model": ErrorResponse, "description": "Validation error"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
        409: {"model": ErrorResponse, "description": "Content already exists"},
    },
)
async def add_source(
    source_type: SourceTypeForm = Form(..., description="Source type"),
    source_url: str | None = Form(default=None, description="URL for youtube_video or web_page"),
    title: str | None = Form(default=None, description="Title for manual_text"),
    text: str | None = Form(default=None, description="Text content for manual_text"),
    file: UploadFile | None = File(default=None, description="PDF file for pdf_file"),
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> ContentItemResponse:
    """Add content from different sources: YouTube URL, PDF file, web page URL, or manual text."""
    workspace, member = workspace_ctx
    require_role(
        member,
        [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.CONTRACTOR],
    )

    service = ContentService(db)
    item = await service.add_source(
        workspace_id=workspace.id,
        user_id=current_user.id,
        source_type=SourceType(source_type.value),
        source_url=source_url,
        title=title,
        text=text,
        file=file,
    )
    return item  # type: ignore[return-value]


@router.get(
    "",
    response_model=PaginatedResponse[ContentItemShortResponse],
    summary="List workspace content",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def list_content(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    source_type: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[ContentItemShortResponse]:
    """List content in workspace with filters and pagination."""
    workspace, _member = workspace_ctx
    pagination = PaginationParams(page=page, size=size)

    service = ContentService(db)
    return await service.list_content(  # type: ignore[return-value]
        workspace_id=workspace.id,
        pagination=pagination,
        status=status_filter,
        source_type=source_type,
        search=search,
    )


@router.get(
    "/{content_id}",
    response_model=ContentItemResponse,
    summary="Get content details",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Content not found"},
    },
)
async def get_content(
    content_id: int,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> ContentItemResponse:
    """Get content item details."""
    workspace, _member = workspace_ctx

    service = ContentService(db)
    return await service.get_content(workspace.id, content_id)  # type: ignore[return-value]


@router.delete(
    "/{content_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete content",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Content not found"},
    },
)
async def delete_content(
    content_id: int,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete content (soft delete). Cancels background parsing."""
    workspace, member = workspace_ctx
    require_role(member, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR])

    service = ContentService(db)
    await service.delete_content(workspace.id, content_id)


@router.post(
    "/{content_id}/retry",
    response_model=ContentItemResponse,
    summary="Retry failed content parsing",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Insufficient permissions"},
        404: {"model": ErrorResponse, "description": "Content not found"},
    },
)
async def retry_content(
    content_id: int,
    current_user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> ContentItemResponse:
    """Retry parsing for content with FAILED status."""
    workspace, member = workspace_ctx
    require_role(member, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR])

    service = ContentService(db)
    return await service.retry_content(workspace.id, content_id)  # type: ignore[return-value]
