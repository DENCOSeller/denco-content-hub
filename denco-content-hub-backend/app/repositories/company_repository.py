from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import func, select

from app.exceptions import NotFoundException
from app.models.company import Company
from app.models.content_item import ContentItem
from app.models.workspace import Workspace, WorkspaceMember
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams


class CompanyRepository(BaseRepository[Company]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Company, db)

    async def get_by_slug(self, slug: str) -> Company | None:
        query = self._base_query().where(Company.slug == slug)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_default(self) -> Company:
        query = self._base_query().where(Company.is_default.is_(True))
        result = await self.db.execute(query)
        instance = result.scalar_one_or_none()
        if instance is None:
            raise NotFoundException("Default company not found")
        return instance

    async def get_all(
        self,
        params: PaginationParams,
        search: str | None = None,
    ) -> PaginatedResponse[Company]:
        query = self._base_query().order_by(Company.created_at.desc())
        if search:
            query = query.where(Company.name.ilike(f"%{search}%"))
        return await self.paginate(query, params)

    async def has_active_workspaces(self, company_id: int) -> bool:
        query = (
            select(func.count())
            .select_from(Workspace)
            .where(
                Workspace.company_id == company_id,
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
        query = self._base_query().where(Company.slug == slug)
        if exclude_id is not None:
            query = query.where(Company.id != exclude_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None

    async def get_detail_stats(self, company_id: int) -> dict[str, int]:
        """Get workspaces_count, members_count, content_count for a company."""
        ws_query = (
            select(func.count())
            .select_from(Workspace)
            .where(
                Workspace.company_id == company_id,
                Workspace.deleted_at.is_(None),
            )
        )
        members_query = (
            select(func.count(func.distinct(WorkspaceMember.user_id)))
            .select_from(WorkspaceMember)
            .join(Workspace, WorkspaceMember.workspace_id == Workspace.id)
            .where(
                Workspace.company_id == company_id,
                Workspace.deleted_at.is_(None),
            )
        )
        content_query = (
            select(func.count())
            .select_from(ContentItem)
            .join(Workspace, ContentItem.workspace_id == Workspace.id)
            .where(
                Workspace.company_id == company_id,
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
