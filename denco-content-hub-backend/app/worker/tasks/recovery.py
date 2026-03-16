from datetime import UTC, datetime, timedelta

import structlog

from app.models.content_item import ContentItem, ContentStatus
from app.models.transcription import DiarizationStatus, Transcription, TranscriptionStatus
from app.worker.celery_app import celery_app
from app.worker.db import SyncSessionLocal

logger = structlog.get_logger()

STUCK_THRESHOLD_MINUTES = 10


@celery_app.task(name="recover_stuck_items")
def recover_stuck_items() -> dict:
    """Find and re-dispatch stuck pipeline items."""
    db = SyncSessionLocal()
    threshold = datetime.now(UTC) - timedelta(minutes=STUCK_THRESHOLD_MINUTES)
    recovered = 0
    try:
        # 1. ContentItems stuck in DOWNLOADING
        stuck_downloads = (
            db.query(ContentItem)
            .filter(
                ContentItem.status == ContentStatus.DOWNLOADING,
                ContentItem.updated_at < threshold,
                ContentItem.deleted_at.is_(None),
            )
            .all()
        )
        for item in stuck_downloads:
            from app.worker.tasks.download_audio import download_audio_task

            download_audio_task.delay(item.id)
            recovered += 1
            logger.info("Recovered stuck download", content_item_id=item.id)

        # 2. Transcriptions stuck in PENDING
        stuck_transcriptions = (
            db.query(Transcription)
            .join(ContentItem)
            .filter(
                Transcription.status == TranscriptionStatus.PENDING,
                Transcription.updated_at < threshold,
                ContentItem.deleted_at.is_(None),
            )
            .all()
        )
        for t in stuck_transcriptions:
            from app.worker.tasks.transcribe_content import transcribe_content_task

            transcribe_content_task.delay(t.id)
            recovered += 1
            logger.info("Recovered stuck transcription", transcription_id=t.id)

        # 3. Diarizations stuck in PENDING
        stuck_diarizations = (
            db.query(Transcription)
            .join(ContentItem)
            .filter(
                Transcription.diarization_status == DiarizationStatus.PENDING,
                Transcription.updated_at < threshold,
                ContentItem.deleted_at.is_(None),
            )
            .all()
        )
        for t in stuck_diarizations:
            from app.worker.tasks.diarize_content import diarize_content_task

            diarize_content_task.delay(t.id)
            recovered += 1
            logger.info("Recovered stuck diarization", transcription_id=t.id)

    finally:
        db.close()

    logger.info("Recovery task completed", recovered=recovered)
    return {"recovered": recovered}
