from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.models.chat import ChatAttachment, ChatMessage, ChatRole, ChatSession
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from datetime import datetime

    from sqlalchemy.ext.asyncio import AsyncSession


class ChatSessionRepository(BaseRepository[ChatSession]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(ChatSession, db)

    async def get_user_sessions(self, user_id: int, limit: int = 50) -> list[ChatSession]:
        query = (
            self._base_query()
            .where(ChatSession.user_id == user_id)
            .order_by(ChatSession.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_id_for_user(self, session_id: int, user_id: int) -> ChatSession | None:
        query = self._base_query().where(ChatSession.id == session_id, ChatSession.user_id == user_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()


class ChatMessageRepository(BaseRepository[ChatMessage]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(ChatMessage, db)

    async def get_session_messages(self, session_id: int, limit: int = 20) -> list[ChatMessage]:
        query = (
            select(ChatMessage)
            .options(selectinload(ChatMessage.attachments))
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_user_messages_since(self, user_id: int, since: datetime) -> int:
        query = (
            select(func.count())
            .select_from(ChatMessage)
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(
                ChatSession.user_id == user_id,
                ChatSession.deleted_at.is_(None),
                ChatMessage.role == ChatRole.USER,
                ChatMessage.created_at >= since,
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one()


class ChatAttachmentRepository(BaseRepository[ChatAttachment]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(ChatAttachment, db)

    async def get_user_unlinked(self, attachment_ids: list[int], user_id: int) -> list[ChatAttachment]:
        query = select(ChatAttachment).where(
            ChatAttachment.id.in_(attachment_ids),
            ChatAttachment.user_id == user_id,
            ChatAttachment.message_id.is_(None),
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def link_to_message(self, attachment_ids: list[int], message_id: int, user_id: int) -> None:
        attachments = await self.get_user_unlinked(attachment_ids, user_id)
        for att in attachments:
            att.message_id = message_id
        await self.db.flush()
