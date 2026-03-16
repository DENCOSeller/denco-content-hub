from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.exceptions import ConflictException, ForbiddenException
from app.repositories.company_repository import CompanyRepository
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.company import (
    CompanyCreate,
    CompanyDetailResponse,
    CompanyResponse,
    CompanyUpdate,
)
from app.utils.slugify import slugify

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()

MAX_COMPANIES = 100


class CompanyService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.company_repo = CompanyRepository(db)

    async def create_company(self, data: CompanyCreate) -> CompanyResponse:
        total = await self.company_repo.get_all(PaginationParams(page=1, size=1))
        if total.total >= MAX_COMPANIES:
            raise ConflictException(f"Maximum of {MAX_COMPANIES} companies reached")

        slug = await self._generate_unique_slug(data.name)
        company = await self.company_repo.create(
            name=data.name,
            slug=slug,
            is_default=False,
        )
        await self.db.commit()
        logger.info("Company created", company_id=company.id, slug=slug)
        return CompanyResponse.model_validate(company)

    async def get_company(self, company_id: int) -> CompanyDetailResponse:
        company = await self.company_repo.get_by_id(company_id)
        stats = await self.company_repo.get_detail_stats(company_id)
        return CompanyDetailResponse(
            id=company.id,
            name=company.name,
            slug=company.slug,
            is_default=company.is_default,
            created_at=company.created_at,
            **stats,
        )

    async def list_companies(
        self,
        params: PaginationParams,
        search: str | None = None,
    ) -> PaginatedResponse[CompanyResponse]:
        page = await self.company_repo.get_all(params, search)
        items = [CompanyResponse.model_validate(c) for c in page.items]
        return PaginatedResponse(
            items=items,
            total=page.total,
            page=page.page,
            size=page.size,
            pages=page.pages,
        )

    async def update_company(
        self,
        company_id: int,
        data: CompanyUpdate,
    ) -> CompanyResponse:
        company = await self.company_repo.get_by_id(company_id)
        update_data: dict[str, str] = {}

        if data.name is not None and data.name != company.name:
            slug = await self._generate_unique_slug(data.name, exclude_id=company_id)
            update_data["name"] = data.name
            update_data["slug"] = slug

        if update_data:
            company = await self.company_repo.update(company_id, **update_data)
            await self.db.commit()
            logger.info("Company updated", company_id=company_id)

        return CompanyResponse.model_validate(company)

    async def delete_company(self, company_id: int) -> None:
        company = await self.company_repo.get_by_id(company_id)

        if company.is_default:
            raise ForbiddenException("Cannot delete default company")

        if await self.company_repo.has_active_workspaces(company_id):
            raise ForbiddenException("Cannot delete company with active workspaces")

        await self.company_repo.soft_delete(company_id)
        await self.db.commit()
        logger.info("Company deleted", company_id=company_id)

    async def _generate_unique_slug(
        self,
        name: str,
        exclude_id: int | None = None,
    ) -> str:
        base_slug = slugify(name)
        if not base_slug:
            base_slug = "company"

        slug = base_slug
        counter = 1
        while await self.company_repo.slug_exists(slug, exclude_id=exclude_id):
            slug = f"{base_slug}-{counter}"
            counter += 1
        return slug
