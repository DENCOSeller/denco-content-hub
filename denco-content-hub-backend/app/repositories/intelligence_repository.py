from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import select

from app.models.content_intelligence import ContentIntelligence
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class IntelligenceRepository(BaseRepository[ContentIntelligence]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(ContentIntelligence, db)

    async def get_by_content_item(self, content_item_id: int) -> ContentIntelligence | None:
        query = select(ContentIntelligence).where(ContentIntelligence.content_item_id == content_item_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_competitor_post(self, post_id: int) -> ContentIntelligence | None:
        query = select(ContentIntelligence).where(ContentIntelligence.competitor_post_id == post_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_trend_item(self, trend_item_id: int) -> ContentIntelligence | None:
        query = select(ContentIntelligence).where(ContentIntelligence.trend_item_id == trend_item_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_or_update(
        self,
        source_type: str,
        source_id_field: str,
        source_id: int,
        workspace_id: int,
        **kwargs: Any,
    ) -> ContentIntelligence:
        query = select(ContentIntelligence).where(getattr(ContentIntelligence, source_id_field) == source_id)
        result = await self.db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            for key, value in kwargs.items():
                setattr(existing, key, value)
            await self.db.flush()
            await self.db.refresh(existing)
            return existing

        return await self.create(
            source_type=source_type,
            workspace_id=workspace_id,
            **{source_id_field: source_id},
            **kwargs,
        )
