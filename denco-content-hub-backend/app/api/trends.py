from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_workspace_from_path, require_role
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.repositories.trend_repository import TrendItemFilters
from app.schemas.common import ErrorResponse, PaginatedResponse, PaginationParams
from app.schemas.trend import (
    TaskAcceptedResponse,
    TrendAlertResponse,
    TrendAlertSettingsResponse,
    TrendAlertSettingsUpdate,
    TrendItemDetailResponse,
    TrendItemResponse,
    TrendNicheCreate,
    TrendNicheResponse,
    TrendNicheUpdate,
    TrendSnapshotResponse,
)
from app.services.trend_service import TrendDiscoveryService

router = APIRouter(tags=["Trends"])


# ── Niches (BEFORE /trends/{trend_id} to avoid route conflicts) ──────


@router.get(
    "/workspaces/{workspace_id}/trends/niches",
    response_model=PaginatedResponse[TrendNicheResponse],
    summary="List trend niches",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def list_niches(
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    active_only: bool = Query(False),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[TrendNicheResponse]:
    workspace, _member = ws
    service = TrendDiscoveryService(db)
    return await service.list_niches(
        workspace.id,
        PaginationParams(page=page, size=size),
        active_only=active_only,
    )


@router.post(
    "/workspaces/{workspace_id}/trends/niches",
    response_model=TrendNicheResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create trend niche",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def create_niche(
    data: TrendNicheCreate,
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TrendNicheResponse:
    workspace, _member = ws
    service = TrendDiscoveryService(db)
    return await service.create_niche(
        workspace.id,
        name=data.name,
        keywords=data.keywords,
        platforms=data.platforms,
        monitoring_interval_hours=data.monitoring_interval_hours,
    )


@router.get(
    "/workspaces/{workspace_id}/trends/niches/{niche_id}",
    response_model=TrendNicheResponse,
    summary="Get trend niche details",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Niche not found"},
    },
)
async def get_niche(
    niche_id: int,
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> TrendNicheResponse:
    workspace, _member = ws
    service = TrendDiscoveryService(db)
    niche = await service.get_niche(niche_id)
    if niche.workspace_id != workspace.id:
        raise HTTPException(status_code=404, detail="Niche not found")
    return niche


@router.patch(
    "/workspaces/{workspace_id}/trends/niches/{niche_id}",
    response_model=TrendNicheResponse,
    summary="Update trend niche",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Niche not found"},
    },
)
async def update_niche(
    niche_id: int,
    data: TrendNicheUpdate,
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TrendNicheResponse:
    workspace, _member = ws
    service = TrendDiscoveryService(db)
    niche = await service.get_niche(niche_id)
    if niche.workspace_id != workspace.id:
        raise HTTPException(status_code=404, detail="Niche not found")
    update_data = data.model_dump(exclude_unset=True)
    return await service.update_niche(niche_id, **update_data)


@router.delete(
    "/workspaces/{workspace_id}/trends/niches/{niche_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete (deactivate) trend niche",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Niche not found"},
    },
)
async def delete_niche(
    niche_id: int,
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    workspace, _member = ws
    service = TrendDiscoveryService(db)
    niche = await service.get_niche(niche_id)
    if niche.workspace_id != workspace.id:
        raise HTTPException(status_code=404, detail="Niche not found")
    await service.delete_niche(niche_id)


# ── Alert Settings (BEFORE /alerts/{alert_id}) ─────────────────────


@router.get(
    "/workspaces/{workspace_id}/trends/alerts/settings",
    response_model=TrendAlertSettingsResponse,
    summary="Get trend alert settings",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def get_alert_settings(
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> TrendAlertSettingsResponse:
    workspace, _member = ws
    service = TrendDiscoveryService(db)
    return await service.get_alert_settings(workspace.id)


@router.put(
    "/workspaces/{workspace_id}/trends/alerts/settings",
    response_model=TrendAlertSettingsResponse,
    summary="Update trend alert settings",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def update_alert_settings(
    data: TrendAlertSettingsUpdate,
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TrendAlertSettingsResponse:
    workspace, _member = ws
    service = TrendDiscoveryService(db)
    update_data = data.model_dump(exclude_unset=True)
    return await service.update_alert_settings(workspace.id, **update_data)


# ── Alerts (BEFORE /trends/{trend_id}) ──────────────────────────────


@router.get(
    "/workspaces/{workspace_id}/trends/alerts",
    response_model=PaginatedResponse[TrendAlertResponse],
    summary="List trend alerts",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def list_alerts(
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    unread_only: bool = Query(False),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[TrendAlertResponse]:
    workspace, _member = ws
    service = TrendDiscoveryService(db)
    return await service.list_alerts(
        workspace.id,
        PaginationParams(page=page, size=size),
        unread_only=unread_only,
    )


@router.patch(
    "/workspaces/{workspace_id}/trends/alerts/{alert_id}/read",
    response_model=TrendAlertResponse,
    summary="Mark alert as read",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Alert not found"},
    },
)
async def mark_alert_read(
    alert_id: int,
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TrendAlertResponse:
    workspace, _member = ws
    service = TrendDiscoveryService(db)
    alert = await service.get_alert(alert_id)
    if alert.workspace_id != workspace.id:
        raise HTTPException(status_code=404, detail="Alert not found")
    return await service.mark_alert_read(alert_id)


@router.post(
    "/workspaces/{workspace_id}/trends/alerts/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark all alerts as read",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def mark_all_alerts_read(
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> None:
    workspace, _member = ws
    service = TrendDiscoveryService(db)
    await service.mark_all_alerts_read(workspace.id)


# ── Discover now ─────────────────────────────────────────────────────


@router.post(
    "/workspaces/{workspace_id}/trends/discover-now",
    response_model=TaskAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger manual trend discovery",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def discover_now(
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskAcceptedResponse:
    _workspace, _member = ws

    from app.worker.tasks.trend_discovery import discover_trends_batch

    discover_trends_batch.delay()
    return TaskAcceptedResponse(
        status="accepted",
        message="Обнаружение трендов запущено",
    )


# ── Trend Items ──────────────────────────────────────────────────────


@router.get(
    "/workspaces/{workspace_id}/trends",
    response_model=PaginatedResponse[TrendItemResponse],
    summary="List trend items",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Workspace not found"},
    },
)
async def list_trends(
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    platform: str | None = Query(None),
    niche_id: int | None = Query(None),
    stage: str | None = Query(None),
    orientation: str | None = Query(None),
    min_viral_score: float | None = Query(None),
    sort_by: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[TrendItemResponse]:
    workspace, _member = ws
    service = TrendDiscoveryService(db)
    filters = TrendItemFilters(
        platform=platform,
        niche_id=niche_id,
        stage=stage,
        orientation=orientation,
        min_viral_score=min_viral_score,
    )
    return await service.list_trend_items(
        workspace.id,
        PaginationParams(page=page, size=size),
        filters=filters,
    )


@router.get(
    "/workspaces/{workspace_id}/trends/{trend_id}",
    response_model=TrendItemDetailResponse,
    summary="Get trend item details",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Trend item not found"},
    },
)
async def get_trend(
    trend_id: int,
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
) -> TrendItemDetailResponse:
    workspace, _member = ws
    service = TrendDiscoveryService(db)
    trend = await service.get_trend_item(trend_id)
    if trend.workspace_id != workspace.id:
        raise HTTPException(status_code=404, detail="Trend item not found")
    return trend


@router.get(
    "/workspaces/{workspace_id}/trends/{trend_id}/snapshots",
    response_model=list[TrendSnapshotResponse],
    summary="Get trend item metric snapshots",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Trend item not found"},
    },
)
async def list_snapshots(
    trend_id: int,
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> list[TrendSnapshotResponse]:
    workspace, _member = ws
    service = TrendDiscoveryService(db)
    trend = await service.get_trend_item(trend_id)
    if trend.workspace_id != workspace.id:
        raise HTTPException(status_code=404, detail="Trend item not found")
    return await service.list_snapshots(trend_id, limit=limit)


@router.post(
    "/workspaces/{workspace_id}/trends/{trend_id}/analyze",
    response_model=TaskAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger Intelligence analysis for trend item",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Trend item not found"},
    },
)
async def analyze_trend(
    trend_id: int,
    ws: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskAcceptedResponse:
    workspace, member = ws
    service = TrendDiscoveryService(db)
    trend = await service.get_trend_item(trend_id)
    if trend.workspace_id != workspace.id:
        raise HTTPException(status_code=404, detail="Trend item not found")
    require_role(
        member,
        [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.CONTRACTOR],
    )
    from app.services.intelligence_service import IntelligenceService

    intelligence_service = IntelligenceService(db)
    await intelligence_service.generate_trend_item_intelligence(workspace.id, trend_id)
    return TaskAcceptedResponse(
        status="accepted",
        message="Intelligence анализ запущен",
    )
