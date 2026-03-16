from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import or_

from app.exceptions import NotFoundException
from app.models.library_item import LibraryItem
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams
    from app.schemas.library import LibraryItemFilters


def _escape_like(value: str) -> str:
    """Escape LIKE wildcards (%, _, \\) in user input."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class LibraryItemRepository(BaseRepository[LibraryItem]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(LibraryItem, db)

    async def create(self, workspace_id: int, data: dict[str, Any]) -> LibraryItem:
        """Create a library item."""
        return await super().create(workspace_id=workspace_id, **data)

    async def get_by_id_in_workspace(self, workspace_id: int, item_id: int) -> LibraryItem:
        """Get library item by ID within a workspace."""
        query = self._base_query().where(LibraryItem.workspace_id == workspace_id).where(LibraryItem.id == item_id)
        result = await self.db.execute(query)
        instance = result.scalar_one_or_none()
        if instance is None:
            raise NotFoundException("LibraryItem not found")
        return instance

    async def list(
        self,
        workspace_id: int,
        filters: LibraryItemFilters,
        pagination: PaginationParams,
    ) -> PaginatedResponse[LibraryItem]:
        """List library items with filters and pagination."""
        query = self._base_query().where(LibraryItem.workspace_id == workspace_id)

        if filters.platform is not None:
            query = query.where(LibraryItem.platform == filters.platform)
        if filters.content_type is not None:
            query = query.where(LibraryItem.content_type == filters.content_type)
        if filters.category is not None:
            query = query.where(LibraryItem.category == filters.category)
        if filters.status is not None:
            query = query.where(LibraryItem.status == filters.status)
        if filters.hunt_level is not None:
            query = query.where(LibraryItem.hunt_level == filters.hunt_level)
        if filters.search:
            pattern = f"%{_escape_like(filters.search)}%"
            query = query.where(
                or_(
                    LibraryItem.title.ilike(pattern, escape="\\"),
                    LibraryItem.source_text.ilike(pattern, escape="\\"),
                )
            )

        query = query.order_by(LibraryItem.created_at.desc())
        return await self.paginate(query, pagination)

    async def update_in_workspace(
        self,
        workspace_id: int,
        item_id: int,
        data: dict[str, Any],
    ) -> LibraryItem:
        """Update a library item within a workspace."""
        instance = await self.get_by_id_in_workspace(workspace_id, item_id)
        for key, value in data.items():
            setattr(instance, key, value)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def soft_delete_in_workspace(self, workspace_id: int, item_id: int) -> LibraryItem:
        """Soft delete a library item within a workspace."""
        instance = await self.get_by_id_in_workspace(workspace_id, item_id)
        from datetime import UTC, datetime

        instance.deleted_at = datetime.now(UTC)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance
