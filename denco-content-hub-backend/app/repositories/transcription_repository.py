from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.transcription import Transcription, TranscriptionStatus
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class TranscriptionRepository(BaseRepository[Transcription]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Transcription, db)

    async def get_by_content_id(self, content_item_id: int) -> Transcription | None:
        """Get transcription by content_item_id."""
        query = select(Transcription).where(Transcription.content_item_id == content_item_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def update_status(
        self,
        transcription: Transcription,
        status: TranscriptionStatus,
        error_message: str | None = None,
        **kwargs: object,
    ) -> Transcription:
        """Update transcription status and optional fields."""
        transcription.status = status
        transcription.error_message = error_message
        for key, value in kwargs.items():
            setattr(transcription, key, value)
        await self.db.flush()
        await self.db.refresh(transcription)
        return transcription

    async def get_stuck(self, threshold_minutes: int = 60) -> list[Transcription]:
        """Get transcriptions stuck in PROCESSING longer than threshold."""
        cutoff = datetime.now(UTC) - timedelta(minutes=threshold_minutes)
        query = (
            select(Transcription)
            .options(selectinload(Transcription.content_item))
            .where(
                Transcription.status == TranscriptionStatus.PROCESSING,
                Transcription.updated_at < cutoff,
            )
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def reset_stuck(self, threshold_minutes: int = 60) -> list[Transcription]:
        """Reset stuck transcriptions to FAILED. Returns affected rows."""
        stuck = await self.get_stuck(threshold_minutes)
        for t in stuck:
            t.status = TranscriptionStatus.FAILED
            t.error_message = "Auto-reset: stuck in processing"
        if stuck:
            await self.db.flush()
        return stuck
