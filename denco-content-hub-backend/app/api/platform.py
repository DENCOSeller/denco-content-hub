from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.dependencies import require_platform_owner
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.platform import (
    PlatformJoinRequest,
    PlatformUserResponse,
    PlatformWorkspaceResponse,
)
from app.schemas.workspace import WorkspaceMemberResponse
from app.services.platform_service import PlatformService

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.user import User

router = APIRouter(prefix="/platform", tags=["platform"])


@router.get(
    "/workspaces",
    response_model=PaginatedResponse[PlatformWorkspaceResponse],
    summary="List all workspaces (platform owner)",
    status_code=200,
    responses={403: {"description": "Not a platform owner"}},
)
async def list_workspaces(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None, max_length=255),
    include_personal: bool = Query(default=False),
    company_id: int | None = Query(default=None, description="Filter by company"),
    current_user: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[PlatformWorkspaceResponse]:
    service = PlatformService(db)
    return await service.list_workspaces(PaginationParams(page=page, size=size), search, include_personal, company_id)


@router.get(
    "/workspaces/{workspace_id}",
    response_model=PlatformWorkspaceResponse,
    summary="Get workspace details (platform owner)",
    status_code=200,
    responses={403: {"description": "Not a platform owner"}, 404: {"description": "Workspace not found"}},
)
async def get_workspace_detail(
    workspace_id: int,
    current_user: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> PlatformWorkspaceResponse:
    service = PlatformService(db)
    return await service.get_workspace_detail(workspace_id)


@router.post(
    "/workspaces/{workspace_id}/join",
    response_model=WorkspaceMemberResponse,
    summary="Join workspace as platform owner",
    status_code=201,
    responses={403: {"description": "Not a platform owner"}, 409: {"description": "Already a member"}},
)
async def join_workspace(
    workspace_id: int,
    data: PlatformJoinRequest,
    current_user: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceMemberResponse:
    service = PlatformService(db)
    member = await service.join_workspace(current_user, workspace_id, data)
    return WorkspaceMemberResponse(
        id=member.id,
        user_id=member.user_id,
        user_name=current_user.name,
        user_email=current_user.email,
        role=member.role,
        created_at=member.created_at,
    )


@router.get(
    "/users",
    response_model=PaginatedResponse[PlatformUserResponse],
    summary="List all users (platform owner)",
    status_code=200,
    responses={403: {"description": "Not a platform owner"}},
)
async def list_users(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None, max_length=255),
    current_user: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[PlatformUserResponse]:
    service = PlatformService(db)
    return await service.list_users(PaginationParams(page=page, size=size), search)
