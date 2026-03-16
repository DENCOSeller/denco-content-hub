from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.exceptions import NotFoundException
from app.models.content_item import ContentItem
from app.models.workspace import Workspace, WorkspaceMember
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams


class WorkspaceRepository(BaseRepository[Workspace]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Workspace, db)

    async def get_by_id(self, entity_id: int) -> Workspace:
        """Override to eagerly load company relationship."""
        query = self._base_query().options(selectinload(Workspace.company)).where(Workspace.id == entity_id)
        result = await self.db.execute(query)
        instance = result.scalar_one_or_none()
        if instance is None:
            raise NotFoundException("Workspace not found")
        return instance

    async def get_by_slug(self, slug: str) -> Workspace | None:
        query = self._base_query().where(Workspace.slug == slug)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_user_workspaces(self, user_id: int) -> list[Workspace]:
        query = (
            self._base_query()
            .options(selectinload(Workspace.company))
            .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
            .where(WorkspaceMember.user_id == user_id)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_personal(self, user_id: int) -> Workspace | None:
        query = (
            self._base_query()
            .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
            .where(WorkspaceMember.user_id == user_id, Workspace.is_personal.is_(True))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_all_workspaces(
        self,
        params: PaginationParams,
        search: str | None = None,
        include_personal: bool = False,
        company_id: int | None = None,
    ) -> PaginatedResponse[Workspace]:
        query = self._base_query().options(selectinload(Workspace.company))
        if not include_personal:
            query = query.where(Workspace.is_personal.is_(False))
        if company_id is not None:
            query = query.where(Workspace.company_id == company_id)
        if search:
            query = query.where(Workspace.name.ilike(f"%{search}%"))
        query = query.order_by(Workspace.created_at.desc())
        return await self.paginate(query, params)

    async def get_members_count(self, workspace_id: int) -> int:
        query = select(func.count()).where(WorkspaceMember.workspace_id == workspace_id)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_content_count(self, workspace_id: int) -> int:
        query = select(func.count()).where(
            ContentItem.workspace_id == workspace_id,
            ContentItem.deleted_at.is_(None),
        )
        result = await self.db.execute(query)
        return result.scalar_one()
