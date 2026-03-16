from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, Query, Response

from app.database import get_db
from app.dependencies import get_company_member, require_company_admin
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.knowledge import (
    CompanyMemberCreate,
    CompanyMemberResponse,
    CompanyMemberUpdate,
)
from app.services.company_member_service import CompanyMemberService

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.company_member import CompanyMember

router = APIRouter(prefix="/companies/{company_id}/members", tags=["company-members"])


@router.get(
    "",
    response_model=PaginatedResponse[CompanyMemberResponse],
    summary="List company members",
    status_code=200,
    responses={403: {"description": "Not a company member"}},
)
async def list_members(
    company_id: int,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    _member: CompanyMember = Depends(get_company_member),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[CompanyMemberResponse]:
    service = CompanyMemberService(db)
    return await service.list_members(company_id, PaginationParams(page=page, size=size))


@router.post(
    "",
    response_model=CompanyMemberResponse,
    summary="Add company member",
    status_code=201,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "User not found"},
        409: {"description": "Already a member"},
    },
)
async def add_member(
    company_id: int,
    data: CompanyMemberCreate,
    actor_member: CompanyMember = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> CompanyMemberResponse:
    service = CompanyMemberService(db)
    return await service.add_member(actor_member, company_id, data)


@router.patch(
    "/{member_id}",
    response_model=CompanyMemberResponse,
    summary="Update company member role",
    status_code=200,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Member not found"},
    },
)
async def update_member_role(
    company_id: int,
    member_id: int,
    data: CompanyMemberUpdate,
    actor_member: CompanyMember = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> CompanyMemberResponse:
    service = CompanyMemberService(db)
    return await service.update_member_role(actor_member, company_id, member_id, data)


@router.delete(
    "/{member_id}",
    summary="Remove company member",
    status_code=204,
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Member not found"},
    },
)
async def remove_member(
    company_id: int,
    member_id: int,
    actor_member: CompanyMember = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    service = CompanyMemberService(db)
    await service.remove_member(actor_member, company_id, member_id)
    return Response(status_code=204)
