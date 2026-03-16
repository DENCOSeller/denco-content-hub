from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.exceptions import NotFoundException
from app.models.content_item import ContentItem, ContentStatus, SourceType
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams


def _escape_like(value: str) -> str:
    """Escape LIKE wildcards (%, _, \\) in user input."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class ContentRepository(BaseRepository[ContentItem]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(ContentItem, db)

    async def get_by_workspace(
        self,
        workspace_id: int,
        pagination: PaginationParams,
        status: ContentStatus | None = None,
        source_type: SourceType | None = None,
        search: str | None = None,
    ) -> PaginatedResponse[ContentItem]:
        """List content in workspace with filters and pagination."""
        query = (
            self._base_query()
            .where(ContentItem.workspace_id == workspace_id)
            .options(selectinload(ContentItem.transcription))
        )

        if status is not None:
            query = query.where(ContentItem.status == status)
        if source_type is not None:
            query = query.where(ContentItem.source_type == source_type)
        if search:
            pattern = f"%{_escape_like(search)}%"
            query = query.where(
                or_(
                    ContentItem.title.ilike(pattern, escape="\\"),
                    ContentItem.url.ilike(pattern, escape="\\"),
                )
            )

        query = query.order_by(ContentItem.created_at.desc())
        return await self.paginate(query, pagination)

    async def get_by_id(self, entity_id: int) -> ContentItem:
        """Get content by ID with transcription eager-loaded."""
        query = self._base_query().where(ContentItem.id == entity_id).options(selectinload(ContentItem.transcription))
        result = await self.db.execute(query)
        instance = result.scalar_one_or_none()
        if instance is None:
            raise NotFoundException("ContentItem not found")
        return instance

    async def get_by_video_id_in_workspace(self, workspace_id: int, video_id: str) -> ContentItem | None:
        """Check for duplicate YouTube video in workspace."""
        query = (
            self._base_query()
            .where(ContentItem.workspace_id == workspace_id)
            .where(ContentItem.video_id == video_id)
            .options(selectinload(ContentItem.transcription))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_workspace_and_id(self, workspace_id: int, content_id: int) -> ContentItem | None:
        """Get content by ID within a workspace."""
        query = (
            self._base_query()
            .where(ContentItem.workspace_id == workspace_id)
            .where(ContentItem.id == content_id)
            .options(selectinload(ContentItem.transcription))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create(self, **kwargs: Any) -> ContentItem:
        """Create content item with transcription eager-loaded."""
        instance = ContentItem(**kwargs)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance, attribute_names=["id"])
        # Re-fetch with selectinload so transcription is populated (as None)
        return await self.get_by_id(instance.id)

    async def update_status(
        self,
        content_item: ContentItem,
        status: ContentStatus,
        error_message: str | None = None,
        **metadata: Any,
    ) -> ContentItem:
        """Update status and metadata fields."""
        content_item.status = status
        if error_message is not None:
            content_item.error_message = error_message
        for key, value in metadata.items():
            if hasattr(content_item, key):
                setattr(content_item, key, value)
        await self.db.flush()
        return await self.get_by_id(content_item.id)

    async def count_by_workspace_and_status(self, workspace_id: int, status: ContentStatus) -> int:
        """Count items by status in workspace (for dashboard stats)."""
        query = (
            select(func.count())
            .select_from(ContentItem)
            .where(ContentItem.workspace_id == workspace_id)
            .where(ContentItem.status == status)
            .where(ContentItem.deleted_at.is_(None))
        )
        result = await self.db.execute(query)
        return result.scalar_one()
