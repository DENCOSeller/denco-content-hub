from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.models.library_item import LibraryItem, LibraryStatus
from app.repositories.library_repository import LibraryItemRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams
    from app.schemas.library import LibraryItemCreate, LibraryItemFilters, LibraryItemUpdate

logger = structlog.get_logger()


class LibraryService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = LibraryItemRepository(db)

    async def create_item(
        self,
        workspace_id: int,
        user_id: int,
        data: LibraryItemCreate,
    ) -> LibraryItem:
        """Create a new library item in a workspace."""
        item = await self.repo.create(
            workspace_id=workspace_id,
            data={
                "created_by_user_id": user_id,
                **data.model_dump(exclude_unset=True),
            },
        )
        await self.db.commit()
        await self.db.refresh(item)
        logger.info(
            "Library item created",
            item_id=item.id,
            workspace_id=workspace_id,
        )
        return item

    async def get_item(
        self,
        workspace_id: int,
        item_id: int,
    ) -> LibraryItem:
        """Get a single library item by ID within a workspace."""
        return await self.repo.get_by_id_in_workspace(workspace_id, item_id)

    async def list_items(
        self,
        workspace_id: int,
        filters: LibraryItemFilters,
        pagination: PaginationParams,
    ) -> PaginatedResponse[LibraryItem]:
        """List library items with filters and pagination."""
        return await self.repo.list(
            workspace_id=workspace_id,
            filters=filters,
            pagination=pagination,
        )

    async def update_item(
        self,
        workspace_id: int,
        item_id: int,
        data: LibraryItemUpdate,
    ) -> LibraryItem:
        """Update a library item (edited_content, status, title, source_text)."""
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return await self.repo.get_by_id_in_workspace(workspace_id, item_id)

        # Если статус меняется на PUBLISHED — проставить published_at
        # Skip if already PUBLISHED — keep original published_at
        if data.status == LibraryStatus.PUBLISHED:
            current_item = await self.repo.get_by_id_in_workspace(workspace_id, item_id)
            if current_item.status != LibraryStatus.PUBLISHED:
                from datetime import UTC, datetime

                update_data["published_at"] = datetime.now(UTC)

        item = await self.repo.update_in_workspace(
            workspace_id=workspace_id,
            item_id=item_id,
            data=update_data,
        )
        await self.db.commit()
        await self.db.refresh(item)
        logger.info(
            "Library item updated",
            item_id=item_id,
            workspace_id=workspace_id,
        )
        return item

    async def delete_item(
        self,
        workspace_id: int,
        item_id: int,
    ) -> None:
        """Soft delete a library item."""
        await self.repo.soft_delete_in_workspace(workspace_id, item_id)
        await self.db.commit()
        logger.info(
            "Library item deleted",
            item_id=item_id,
            workspace_id=workspace_id,
        )
