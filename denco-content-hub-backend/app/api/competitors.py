from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_workspace_from_path
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.common import ErrorResponse, PaginatedResponse, PaginationParams
from app.schemas.competitor import (
    CompetitorAnalysisResponse,
    CompetitorChannelCreate,
    CompetitorChannelResponse,
    CompetitorChannelSnapshotResponse,
    CompetitorChannelUpdate,
    CompetitorNotificationResponse,
    CompetitorPostDetailResponse,
    CompetitorPostFilters,
    CompetitorPostResponse,
    ResolveUrlRequest,
    ResolveUrlResponse,
    SyncResponse,
)
from app.services.competitor_service import CompetitorService

router = APIRouter(tags=["Competitors"])

notifications_router = APIRouter(tags=["Competitor Notifications"])


# ── Channels ──────────────────────────────────────────────────────────


@router.post(
    "/workspaces/{workspace_id}/competitors",
    response_model=CompetitorChannelResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add competitor channel",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
        409: {"model": ErrorResponse, "description": "Channel already exists"},
    },
)
async def add_channel(
    data: CompetitorChannelCreate,
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CompetitorChannelResponse:
    workspace, _member = ws
    service = CompetitorService(db)
    return await service.add_channel(workspace.id, current_user.id, data.url)


@router.get(
    "/workspaces/{workspace_id}/competitors",
    response_model=PaginatedResponse[CompetitorChannelResponse],
    summary="List competitor channels",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def list_channels(
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[CompetitorChannelResponse]:
    workspace, _member = ws
    service = CompetitorService(db)
    return await service.list_channels(workspace.id, PaginationParams(page=page, size=size))


@router.get(
    "/competitors/{channel_id}",
    response_model=CompetitorChannelResponse,
    summary="Get competitor channel details",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Access denied"},
        404: {"model": ErrorResponse, "description": "Channel not found"},
    },
)
async def get_channel(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CompetitorChannelResponse:
    service = CompetitorService(db)
    return await service.get_channel(channel_id, current_user.id)


@router.patch(
    "/competitors/{channel_id}",
    response_model=CompetitorChannelResponse,
    summary="Update competitor channel",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Access denied"},
        404: {"model": ErrorResponse, "description": "Channel not found"},
    },
)
async def update_channel(
    channel_id: int,
    data: CompetitorChannelUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CompetitorChannelResponse:
    service = CompetitorService(db)
    return await service.update_channel(channel_id, current_user.id, data)


@router.delete(
    "/competitors/{channel_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete competitor channel (soft delete)",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Access denied"},
        404: {"model": ErrorResponse, "description": "Channel not found"},
    },
)
async def delete_channel(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    service = CompetitorService(db)
    await service.delete_channel(channel_id, current_user.id)


@router.post(
    "/competitors/{channel_id}/sync",
    response_model=SyncResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger channel sync",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Access denied"},
        404: {"model": ErrorResponse, "description": "Channel not found"},
    },
)
async def sync_channel(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SyncResponse:
    service = CompetitorService(db)
    await service.get_channel(channel_id, current_user.id)

    from app.worker.tasks.competitor_sync import sync_single_competitor_channel

    sync_single_competitor_channel.delay(channel_id)
    return SyncResponse(status="accepted", message="Синхронизация запущена")


# ── Snapshots ─────────────────────────────────────────────────────────


@router.get(
    "/competitors/{channel_id}/snapshots",
    response_model=list[CompetitorChannelSnapshotResponse],
    summary="Get competitor channel metric snapshots",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Access denied"},
        404: {"model": ErrorResponse, "description": "Channel not found"},
    },
)
async def list_channel_snapshots(
    channel_id: int,
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CompetitorChannelSnapshotResponse]:
    service = CompetitorService(db)
    return await service.list_channel_snapshots(channel_id, current_user.id, days)


# ── Posts ─────────────────────────────────────────────────────────────


@router.get(
    "/competitors/{channel_id}/posts",
    response_model=PaginatedResponse[CompetitorPostResponse],
    summary="List competitor channel posts",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Access denied"},
        404: {"model": ErrorResponse, "description": "Channel not found"},
    },
)
async def list_channel_posts(
    channel_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    content_type: str | None = Query(None),
    analysis_status: str | None = Query(None),
    min_views: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[CompetitorPostResponse]:
    service = CompetitorService(db)
    filters = CompetitorPostFilters(
        content_type=content_type,
        analysis_status=analysis_status,
        min_views=min_views,
    )
    params = PaginationParams(page=page, size=size)
    return await service.list_channel_posts(channel_id, current_user.id, params, filters)


@router.get(
    "/competitors/posts/{post_id}",
    response_model=CompetitorPostDetailResponse,
    summary="Get competitor post details with analysis",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Access denied"},
        404: {"model": ErrorResponse, "description": "Post not found"},
    },
)
async def get_post_detail(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CompetitorPostDetailResponse:
    service = CompetitorService(db)
    return await service.get_post_detail(post_id, current_user.id)


@router.get(
    "/competitors/posts/{post_id}/analysis",
    response_model=CompetitorAnalysisResponse,
    summary="Get competitor post AI analysis",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Access denied"},
        404: {"model": ErrorResponse, "description": "Analysis not found"},
    },
)
async def get_post_analysis(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CompetitorAnalysisResponse:
    service = CompetitorService(db)
    return await service.get_post_analysis(post_id, current_user.id)


# ── URL Resolve ───────────────────────────────────────────────────────


@router.post(
    "/competitors/resolve-url",
    response_model=ResolveUrlResponse,
    summary="Resolve platform from URL",
    responses={
        400: {"model": ErrorResponse, "description": "URL not recognized"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    },
)
async def resolve_url(
    data: ResolveUrlRequest,
    current_user: User = Depends(get_current_user),
) -> ResolveUrlResponse:
    from app.integrations.competitor.url_resolver import resolve_url as _resolve_url

    platform, platform_id, handle = _resolve_url(data.url)
    return ResolveUrlResponse(platform=platform.value, platform_id=platform_id, handle=handle)


# ── Notifications ─────────────────────────────────────────────────────


@notifications_router.get(
    "/workspaces/{workspace_id}/competitor-notifications",
    response_model=PaginatedResponse[CompetitorNotificationResponse],
    summary="List competitor notifications",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def list_notifications(
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    unread_only: bool = Query(False),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[CompetitorNotificationResponse]:
    workspace, _member = ws
    service = CompetitorService(db)
    return await service.list_notifications(workspace.id, unread_only, PaginationParams(page=page, size=size))


@notifications_router.post(
    "/competitor-notifications/{notification_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark notification as read",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        403: {"model": ErrorResponse, "description": "Access denied"},
        404: {"model": ErrorResponse, "description": "Notification not found"},
    },
)
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    service = CompetitorService(db)
    await service.mark_notification_read(notification_id, current_user.id)


@notifications_router.post(
    "/workspaces/{workspace_id}/competitor-notifications/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark all notifications as read",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def mark_all_notifications_read(
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> None:
    workspace, _member = ws
    service = CompetitorService(db)
    await service.mark_all_notifications_read(workspace.id)
