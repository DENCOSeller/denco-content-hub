from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, Query, Response

from app.database import get_db
from app.dependencies import require_platform_owner
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.company import (
    CompanyCreate,
    CompanyDetailResponse,
    CompanyResponse,
    CompanyUpdate,
)
from app.services.company_service import CompanyService

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.user import User

router = APIRouter(prefix="/platform/companies", tags=["companies"])


@router.get(
    "",
    response_model=PaginatedResponse[CompanyResponse],
    summary="List all companies",
    status_code=200,
    responses={403: {"description": "Not a platform owner"}},
)
async def list_companies(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None, max_length=255),
    current_user: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[CompanyResponse]:
    service = CompanyService(db)
    return await service.list_companies(PaginationParams(page=page, size=size), search)


@router.post(
    "",
    response_model=CompanyResponse,
    summary="Create a company",
    status_code=201,
    responses={403: {"description": "Not a platform owner"}, 409: {"description": "Limit reached"}},
)
async def create_company(
    data: CompanyCreate,
    current_user: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> CompanyResponse:
    service = CompanyService(db)
    return await service.create_company(data)


@router.get(
    "/{company_id}",
    response_model=CompanyDetailResponse,
    summary="Get company details",
    status_code=200,
    responses={403: {"description": "Not a platform owner"}, 404: {"description": "Company not found"}},
)
async def get_company(
    company_id: int,
    current_user: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> CompanyDetailResponse:
    service = CompanyService(db)
    return await service.get_company(company_id)


@router.patch(
    "/{company_id}",
    response_model=CompanyResponse,
    summary="Update a company",
    status_code=200,
    responses={403: {"description": "Not a platform owner"}, 404: {"description": "Company not found"}},
)
async def update_company(
    company_id: int,
    data: CompanyUpdate,
    current_user: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> CompanyResponse:
    service = CompanyService(db)
    return await service.update_company(company_id, data)


@router.delete(
    "/{company_id}",
    summary="Delete a company",
    status_code=204,
    responses={
        403: {"description": "Not a platform owner or cannot delete"},
        404: {"description": "Company not found"},
    },
)
async def delete_company(
    company_id: int,
    current_user: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> Response:
    service = CompanyService(db)
    await service.delete_company(company_id)
    return Response(status_code=204)
