from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import select

from app.models.content_analysis import ContentAnalysis
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class ContentAnalysisRepository(BaseRepository[ContentAnalysis]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(ContentAnalysis, db)

    async def get_by_content_item_id(self, content_item_id: int) -> ContentAnalysis | None:
        """Get analysis by content_item_id."""
        query = self._base_query().where(ContentAnalysis.content_item_id == content_item_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_or_update(self, content_item_id: int, **kwargs: Any) -> ContentAnalysis:
        """Create analysis if not exists, otherwise update existing."""
        existing = await self.get_by_content_item_id(content_item_id)
        if existing:
            for key, value in kwargs.items():
                setattr(existing, key, value)
            await self.db.flush()
            await self.db.refresh(existing)
            return existing
        return await self.create(content_item_id=content_item_id, **kwargs)
