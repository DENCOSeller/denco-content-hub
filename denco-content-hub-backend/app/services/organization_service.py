from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.exceptions import ConflictException, ForbiddenException
from app.repositories.organization_repository import OrganizationRepository
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationDetailResponse,
    OrganizationResponse,
    OrganizationUpdate,
)
from app.utils.slugify import slugify

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()

MAX_ORGANIZATIONS = 100


class OrganizationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.organization_repo = OrganizationRepository(db)

    async def create_organization(self, data: OrganizationCreate) -> OrganizationResponse:
        total = await self.organization_repo.get_all(PaginationParams(page=1, size=1))
        if total.total >= MAX_ORGANIZATIONS:
            raise ConflictException(f"Maximum of {MAX_ORGANIZATIONS} organizations reached")

        slug = await self._generate_unique_slug(data.name)
        organization = await self.organization_repo.create(
            name=data.name,
            slug=slug,
            is_default=False,
        )
        await self.db.commit()
        logger.info("Organization created", organization_id=organization.id, slug=slug)
        return OrganizationResponse.model_validate(organization)

    async def get_organization(self, organization_id: int) -> OrganizationDetailResponse:
        organization = await self.organization_repo.get_by_id(organization_id)
        stats = await self.organization_repo.get_detail_stats(organization_id)
        return OrganizationDetailResponse(
            id=organization.id,
            name=organization.name,
            slug=organization.slug,
            is_default=organization.is_default,
            created_at=organization.created_at,
            **stats,
        )

    async def list_organizations(
        self,
        params: PaginationParams,
        search: str | None = None,
    ) -> PaginatedResponse[OrganizationResponse]:
        page = await self.organization_repo.get_all(params, search)
        items = [OrganizationResponse.model_validate(c) for c in page.items]
        return PaginatedResponse(
            items=items,
            total=page.total,
            page=page.page,
            size=page.size,
            pages=page.pages,
        )

    async def update_organization(
        self,
        organization_id: int,
        data: OrganizationUpdate,
    ) -> OrganizationResponse:
        organization = await self.organization_repo.get_by_id(organization_id)
        update_data: dict[str, str] = {}

        if data.name is not None and data.name != organization.name:
            slug = await self._generate_unique_slug(data.name, exclude_id=organization_id)
            update_data["name"] = data.name
            update_data["slug"] = slug

        if update_data:
            organization = await self.organization_repo.update(organization_id, **update_data)
            await self.db.commit()
            logger.info("Organization updated", organization_id=organization_id)

        return OrganizationResponse.model_validate(organization)

    async def delete_organization(self, organization_id: int) -> None:
        organization = await self.organization_repo.get_by_id(organization_id)

        if organization.is_default:
            raise ForbiddenException("Cannot delete default organization")

        if await self.organization_repo.has_active_workspaces(organization_id):
            raise ForbiddenException("Cannot delete organization with active workspaces")

        await self.organization_repo.soft_delete(organization_id)
        await self.db.commit()
        logger.info("Organization deleted", organization_id=organization_id)

    async def _generate_unique_slug(
        self,
        name: str,
        exclude_id: int | None = None,
    ) -> str:
        base_slug = slugify(name)
        if not base_slug:
            base_slug = "organization"

        slug = base_slug
        counter = 1
        while await self.organization_repo.slug_exists(slug, exclude_id=exclude_id):
            slug = f"{base_slug}-{counter}"
            counter += 1
        return slug
