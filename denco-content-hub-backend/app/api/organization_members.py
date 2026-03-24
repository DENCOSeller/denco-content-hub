from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, Query, Response

from app.database import get_db
from app.dependencies import get_organization_member, require_organization_admin
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.knowledge import (
    OrganizationMemberCreate,
    OrganizationMemberResponse,
    OrganizationMemberUpdate,
)
from app.services.organization_member_service import OrganizationMemberService

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.organization_member import OrganizationMember

router = APIRouter(prefix="/organizations/{organization_id}/members", tags=["organization-members"])


@router.get(
    "",
    response_model=PaginatedResponse[OrganizationMemberResponse],
    summary="List organization members",
    status_code=200,
    responses={403: {"description": "Not an organization member"}},
)
async def list_members(
    organization_id: int,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    _member: OrganizationMember = Depends(get_organization_member),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[OrganizationMemberResponse]:
    service = OrganizationMemberService(db)
    return await service.list_members(organization_id, PaginationParams(page=page, size=size))


@router.post(
    "",
    response_model=OrganizationMemberResponse,
    summary="Add organization member",
    status_code=201,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "User not found"},
        409: {"description": "Already a member"},
    },
)
async def add_member(
    organization_id: int,
    data: OrganizationMemberCreate,
    actor_member: OrganizationMember = Depends(require_organization_admin),
    db: AsyncSession = Depends(get_db),
) -> OrganizationMemberResponse:
    service = OrganizationMemberService(db)
    return await service.add_member(actor_member, organization_id, data)


@router.patch(
    "/{member_id}",
    response_model=OrganizationMemberResponse,
    summary="Update organization member role",
    status_code=200,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Member not found"},
    },
)
async def update_member_role(
    organization_id: int,
    member_id: int,
    data: OrganizationMemberUpdate,
    actor_member: OrganizationMember = Depends(require_organization_admin),
    db: AsyncSession = Depends(get_db),
) -> OrganizationMemberResponse:
    service = OrganizationMemberService(db)
    return await service.update_member_role(actor_member, organization_id, member_id, data)


@router.delete(
    "/{member_id}",
    summary="Remove organization member",
    status_code=204,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Member not found"},
    },
)
async def remove_member(
    organization_id: int,
    member_id: int,
    actor_member: OrganizationMember = Depends(require_organization_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    service = OrganizationMemberService(db)
    await service.remove_member(actor_member, organization_id, member_id)
    return Response(status_code=204)
