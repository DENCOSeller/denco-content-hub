from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, Query, Response

from app.database import get_db
from app.dependencies import require_platform_owner
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationDetailResponse,
    OrganizationResponse,
    OrganizationUpdate,
)
from app.services.organization_service import OrganizationService

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.user import User

router = APIRouter(prefix="/platform/organizations", tags=["organizations"])


@router.get(
    "",
    response_model=PaginatedResponse[OrganizationResponse],
    summary="List all organizations",
    status_code=200,
    responses={403: {"description": "Not a platform owner"}},
)
async def list_organizations(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None, max_length=255),
    current_user: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[OrganizationResponse]:
    service = OrganizationService(db)
    return await service.list_organizations(PaginationParams(page=page, size=size), search)


@router.post(
    "",
    response_model=OrganizationResponse,
    summary="Create an organization",
    status_code=201,
    responses={403: {"description": "Not a platform owner"}, 409: {"description": "Limit reached"}},
)
async def create_organization(
    data: OrganizationCreate,
    current_user: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> OrganizationResponse:
    service = OrganizationService(db)
    return await service.create_organization(data)


@router.get(
    "/{organization_id}",
    response_model=OrganizationDetailResponse,
    summary="Get organization details",
    status_code=200,
    responses={403: {"description": "Not a platform owner"}, 404: {"description": "Organization not found"}},
)
async def get_organization(
    organization_id: int,
    current_user: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> OrganizationDetailResponse:
    service = OrganizationService(db)
    return await service.get_organization(organization_id)


@router.patch(
    "/{organization_id}",
    response_model=OrganizationResponse,
    summary="Update an organization",
    status_code=200,
    responses={403: {"description": "Not a platform owner"}, 404: {"description": "Organization not found"}},
)
async def update_organization(
    organization_id: int,
    data: OrganizationUpdate,
    current_user: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> OrganizationResponse:
    service = OrganizationService(db)
    return await service.update_organization(organization_id, data)


@router.delete(
    "/{organization_id}",
    summary="Delete an organization",
    status_code=204,
    responses={
        403: {"description": "Not a platform owner or cannot delete"},
        404: {"description": "Organization not found"},
    },
)
async def delete_organization(
    organization_id: int,
    current_user: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> Response:
    service = OrganizationService(db)
    await service.delete_organization(organization_id)
    return Response(status_code=204)
