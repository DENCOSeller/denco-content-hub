import os
from uuid import uuid4

import structlog
from celery.exceptions import SoftTimeLimitExceeded
from sqlalchemy.orm import Session

from app.config import settings
from app.integrations.youtube import YouTubeDownloadError, YouTubeParser
from app.models.content_item import ContentItem, ContentStatus
from app.models.transcription import Transcription, TranscriptionStatus
from app.worker.celery_app import celery_app
from app.worker.db import SyncSessionLocal

logger = structlog.get_logger()

MAX_RETRIES = 2


@celery_app.task(
    bind=True,
    name="download_audio",
    max_retries=MAX_RETRIES,
    default_retry_delay=120,
    acks_late=True,
    time_limit=600,
    soft_time_limit=570,
)
def download_audio_task(self, content_item_id: int) -> dict:
    """Download audio from YouTube video as WAV.

    Flow: load item → generate path → yt-dlp download → create Transcription
    → dispatch transcribe_content. Retries with exponential backoff.
    """
    db = SyncSessionLocal()
    output_path: str | None = None
    try:
        item = (
            db.query(ContentItem)
            .filter(
                ContentItem.id == content_item_id,
                ContentItem.deleted_at.is_(None),
            )
            .first()
        )

        if not item:
            logger.warning("Content item not found or deleted", content_item_id=content_item_id)
            return {"status": "skipped", "message": f"ContentItem {content_item_id} not found"}

        # Generate output path
        output_path = f"{settings.audio_storage_path}/{content_item_id}_{uuid4().hex[:8]}"
        os.makedirs(settings.audio_storage_path, exist_ok=True)

        item.processing_step = "Загрузка аудио..."
        db.commit()

        logger.info("Audio download started", content_item_id=content_item_id, url=item.url)

        # Download audio
        parser = YouTubeParser()
        result = parser.download_audio(str(item.url), output_path)

        # Update content item
        item.audio_path = result.file_path
        item.status = ContentStatus.COMPLETED
        item.celery_task_id = None
        item.error_message = None
        item.processing_step = None

        # Create or reset Transcription record (unique constraint on content_item_id)
        transcription = db.query(Transcription).filter(Transcription.content_item_id == item.id).first()
        if transcription:
            transcription.status = TranscriptionStatus.PENDING
            transcription.error_message = None
            transcription.text = None
            transcription.segments = None
            transcription.retry_count = 0
            transcription.celery_task_id = None
        else:
            transcription = Transcription(
                content_item_id=item.id,
                status=TranscriptionStatus.PENDING,
            )
            db.add(transcription)
        db.commit()

        # Dispatch next step AFTER commit
        from app.worker.tasks.transcribe_content import transcribe_content_task

        task = transcribe_content_task.delay(transcription.id)

        transcription.celery_task_id = task.id
        db.commit()

        logger.info(
            "Audio download completed, transcription dispatched",
            content_item_id=content_item_id,
            file_path=result.file_path,
            transcription_id=transcription.id,
        )
        return {
            "status": "completed",
            "content_item_id": content_item_id,
            "transcription_id": transcription.id,
        }

    except SoftTimeLimitExceeded:
        db.rollback()
        _cleanup_audio(output_path)
        _mark_failed(db, content_item_id, "Timeout: audio download took too long")
        logger.error("Audio download timeout", content_item_id=content_item_id)
        return {"status": "failed", "content_item_id": content_item_id, "error": "timeout"}

    except (YouTubeDownloadError, Exception) as exc:
        db.rollback()
        _cleanup_audio(output_path)
        error_msg = str(exc)[:500]

        try:
            item = db.query(ContentItem).filter(ContentItem.id == content_item_id).first()
            if item:
                item.retry_count += 1
                item.error_message = error_msg

                if self.request.retries >= MAX_RETRIES:
                    item.status = ContentStatus.FAILED
                    db.commit()
                    logger.error(
                        "Audio download failed permanently",
                        content_item_id=content_item_id,
                        error=error_msg,
                    )
                    return {"status": "failed", "content_item_id": content_item_id, "error": error_msg}

                db.commit()
        except Exception:
            db.rollback()

        logger.warning(
            "Audio download failed, retrying",
            content_item_id=content_item_id,
            retry=self.request.retries,
            error=error_msg,
        )
        raise self.retry(exc=exc, countdown=120 * (2**self.request.retries)) from exc

    finally:
        db.close()


def _mark_failed(db: Session, content_item_id: int, error_message: str) -> None:
    """Helper to mark content item as FAILED."""
    try:
        item = db.query(ContentItem).filter(ContentItem.id == content_item_id).first()
        if item:
            item.status = ContentStatus.FAILED
            item.error_message = error_message
            item.processing_step = None
            db.commit()
    except Exception:
        db.rollback()


def _cleanup_audio(output_path: str | None) -> None:
    """Remove partially downloaded audio file."""
    if output_path:
        wav_path = output_path + ".wav"
        if os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except OSError:
                logger.warning("Failed to cleanup audio file", path=wav_path)
