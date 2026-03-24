from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import func, select

from app.exceptions import NotFoundException
from app.models.organization import Organization
from app.models.content_item import ContentItem
from app.models.workspace import Workspace, WorkspaceMember
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams


class OrganizationRepository(BaseRepository[Organization]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Organization, db)

    async def get_by_staff_org_id(self, staff_org_id: int) -> Organization | None:
        query = self._base_query().where(Organization.staff_org_id == staff_org_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_staff_org_id_include_deleted(self, staff_org_id: int) -> Organization | None:
        query = select(Organization).where(Organization.staff_org_id == staff_org_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_client_org_id(self, client_org_id: int) -> Organization | None:
        """Get active organization by Client IdP org ID."""
        query = self._base_query().where(Organization.client_org_id == client_org_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_client_org_id_include_deleted(self, client_org_id: int) -> Organization | None:
        """Get organization by Client IdP org ID, including soft-deleted."""
        query = select(Organization).where(Organization.client_org_id == client_org_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Organization | None:
        query = self._base_query().where(Organization.slug == slug)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_default(self) -> Organization:
        query = self._base_query().where(Organization.is_default.is_(True))
        result = await self.db.execute(query)
        instance = result.scalar_one_or_none()
        if instance is None:
            raise NotFoundException("Default organization not found")
        return instance

    async def get_all(
        self,
        params: PaginationParams,
        search: str | None = None,
    ) -> PaginatedResponse[Organization]:
        query = self._base_query().order_by(Organization.created_at.desc())
        if search:
            query = query.where(Organization.name.ilike(f"%{search}%"))
        return await self.paginate(query, params)

    async def has_active_workspaces(self, organization_id: int) -> bool:
        query = (
            select(func.count())
            .select_from(Workspace)
            .where(
                Workspace.organization_id == organization_id,
                Workspace.deleted_at.is_(None),
            )
        )
        result = await self.db.execute(query)
        return (result.scalar_one() or 0) > 0

    async def slug_exists(
        self,
        slug: str,
        exclude_id: int | None = None,
    ) -> bool:
        query = self._base_query().where(Organization.slug == slug)
        if exclude_id is not None:
            query = query.where(Organization.id != exclude_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None

    async def get_detail_stats(self, organization_id: int) -> dict[str, int]:
        """Get workspaces_count, members_count, content_count for an organization."""
        ws_query = (
            select(func.count())
            .select_from(Workspace)
            .where(
                Workspace.organization_id == organization_id,
                Workspace.deleted_at.is_(None),
            )
        )
        members_query = (
            select(func.count(func.distinct(WorkspaceMember.user_id)))
            .select_from(WorkspaceMember)
            .join(Workspace, WorkspaceMember.workspace_id == Workspace.id)
            .where(
                Workspace.organization_id == organization_id,
                Workspace.deleted_at.is_(None),
            )
        )
        content_query = (
            select(func.count())
            .select_from(ContentItem)
            .join(Workspace, ContentItem.workspace_id == Workspace.id)
            .where(
                Workspace.organization_id == organization_id,
                Workspace.deleted_at.is_(None),
                ContentItem.deleted_at.is_(None),
            )
        )
        ws_result = await self.db.execute(ws_query)
        members_result = await self.db.execute(members_query)
        content_result = await self.db.execute(content_query)
        return {
            "workspaces_count": ws_result.scalar_one() or 0,
            "members_count": members_result.scalar_one() or 0,
            "content_count": content_result.scalar_one() or 0,
        }
