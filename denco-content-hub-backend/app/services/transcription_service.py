from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.exceptions import AppException, NotFoundException
from app.models.transcription import Transcription, TranscriptionStatus
from app.repositories.content_repository import ContentRepository
from app.repositories.transcription_repository import TranscriptionRepository
from app.schemas.transcription import TranscriptionResponse

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


class TranscriptionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.transcription_repo = TranscriptionRepository(db)
        self.content_repo = ContentRepository(db)

    async def get_transcription(self, workspace_id: int, content_id: int) -> Transcription | TranscriptionResponse:
        """Get transcription with workspace ownership check.

        Returns synthetic pending response if transcription record
        doesn't exist yet (pipeline hasn't reached download_audio).
        """
        content = await self.content_repo.get_by_workspace_and_id(workspace_id, content_id)
        if not content:
            raise NotFoundException("Content not found")

        transcription = await self.transcription_repo.get_by_content_id(content_id)
        if not transcription:
            return TranscriptionResponse(
                content_item_id=content_id,
                status="pending",
            )
        return transcription

    async def retry_transcription(self, workspace_id: int, content_id: int) -> Transcription:
        """Retry FAILED transcription. Updates existing record, no duplicates."""
        content = await self.content_repo.get_by_workspace_and_id(workspace_id, content_id)
        if not content:
            raise NotFoundException("Content not found")

        transcription = await self.transcription_repo.get_by_content_id(content_id)
        if not transcription:
            raise NotFoundException("Transcription not found")

        if transcription.status != TranscriptionStatus.FAILED:
            raise AppException(
                "Retry is only available for FAILED transcriptions",
                status_code=400,
            )

        if not content.audio_path:
            raise AppException(
                "Audio file not available. Retry content download first.",
                status_code=400,
            )

        transcription.status = TranscriptionStatus.PENDING
        transcription.error_message = None
        transcription.retry_count = 0
        await self.db.flush()
        await self.db.commit()

        from app.worker.tasks.transcribe_content import transcribe_content_task

        task = transcribe_content_task.delay(transcription.id)

        transcription.celery_task_id = task.id
        await self.db.commit()
        await self.db.refresh(transcription)

        logger.info(
            "Transcription retry",
            transcription_id=transcription.id,
            content_id=content_id,
        )
        return transcription
