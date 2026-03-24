from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, Query, Response

from app.database import get_db
from app.dependencies import require_organization_admin, get_organization_member
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.team import (
    TeamResponse,
    TeamWorkspaceAccessCreate,
    TeamWorkspaceAccessResponse,
)
from app.services.team_service import TeamService

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.organization_member import OrganizationMember

router = APIRouter(
    prefix="/organizations/{organization_id}/teams",
    tags=["teams"],
)


@router.get(
    "",
    response_model=PaginatedResponse[TeamResponse],
    summary="List teams for organization",
    status_code=200,
    responses={403: {"description": "Not an organization member"}},
)
async def list_teams(
    organization_id: int,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    _member: OrganizationMember = Depends(get_organization_member),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[TeamResponse]:
    service = TeamService(db)
    return await service.list_teams(organization_id, PaginationParams(page=page, size=size))


@router.get(
    "/{team_id}/workspace-access",
    response_model=list[TeamWorkspaceAccessResponse],
    summary="List workspace access for team",
    status_code=200,
    responses={
        403: {"description": "Not an organization member"},
        404: {"description": "Team not found"},
    },
)
async def get_workspace_access(
    organization_id: int,
    team_id: int,
    _member: OrganizationMember = Depends(get_organization_member),
    db: AsyncSession = Depends(get_db),
) -> list[TeamWorkspaceAccessResponse]:
    service = TeamService(db)
    return await service.get_workspace_access(team_id)


@router.post(
    "/{team_id}/workspace-access",
    response_model=TeamWorkspaceAccessResponse,
    summary="Grant team access to workspace",
    status_code=201,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Team or workspace not found"},
        409: {"description": "Access already exists"},
    },
)
async def add_workspace_access(
    organization_id: int,
    team_id: int,
    data: TeamWorkspaceAccessCreate,
    _admin: OrganizationMember = Depends(require_organization_admin),
    db: AsyncSession = Depends(get_db),
) -> TeamWorkspaceAccessResponse:
    service = TeamService(db)
    return await service.add_workspace_access(team_id, data)


@router.delete(
    "/{team_id}/workspace-access/{workspace_id}",
    summary="Remove team workspace access",
    status_code=204,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Access not found"},
    },
)
async def remove_workspace_access(
    organization_id: int,
    team_id: int,
    workspace_id: int,
    _admin: OrganizationMember = Depends(require_organization_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    service = TeamService(db)
    await service.remove_workspace_access(team_id, workspace_id)
    return Response(status_code=204)
