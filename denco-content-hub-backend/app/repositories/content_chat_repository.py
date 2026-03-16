from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from app.models.content_chat_message import ContentChatMessage
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class ContentChatMessageRepository(BaseRepository[ContentChatMessage]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(ContentChatMessage, db)

    async def get_history(self, content_item_id: int, limit: int = 50) -> list[ContentChatMessage]:
        """Get last N chat messages for content item, ordered by created_at asc."""
        # Subquery: get the last `limit` messages (newest first)
        subquery = (
            select(ContentChatMessage.id)
            .where(ContentChatMessage.content_item_id == content_item_id)
            .order_by(ContentChatMessage.created_at.desc())
            .limit(limit)
        ).subquery()

        # Main query: fetch those messages in chronological order
        query = (
            select(ContentChatMessage)
            .where(ContentChatMessage.id.in_(select(subquery.c.id)))
            .order_by(ContentChatMessage.created_at.asc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())
