import os

import structlog
from celery.exceptions import SoftTimeLimitExceeded

from app.config import settings
from app.integrations.whisper import WhisperError, WhisperTranscriber
from app.models.content_item import ContentItem
from app.models.transcription import Transcription, TranscriptionStatus
from app.worker.celery_app import celery_app
from app.worker.db import SyncSessionLocal

logger = structlog.get_logger()

MAX_RETRIES = 1


@celery_app.task(
    bind=True,
    name="transcribe_content",
    max_retries=MAX_RETRIES,
    default_retry_delay=300,
    acks_late=True,
    time_limit=7200,
    soft_time_limit=7100,
)
def transcribe_content_task(self, transcription_id: int) -> dict:
    """Transcribe audio using local Whisper model.

    Flow: load transcription → verify audio → Whisper transcribe
    → save result → cleanup audio file.
    """
    db = SyncSessionLocal()
    try:
        transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
        if not transcription:
            logger.warning("Transcription not found", transcription_id=transcription_id)
            return {"status": "skipped", "message": f"Transcription {transcription_id} not found"}

        item = (
            db.query(ContentItem)
            .filter(
                ContentItem.id == transcription.content_item_id,
                ContentItem.deleted_at.is_(None),
            )
            .first()
        )
        if not item:
            logger.warning("Content item deleted, skipping transcription", transcription_id=transcription_id)
            return {"status": "skipped", "message": "Content item deleted"}

        # Mark as processing
        transcription.status = TranscriptionStatus.PROCESSING
        item.processing_step = "Транскрибация аудио..."
        db.commit()

        # Verify audio file exists and is not empty
        if not item.audio_path:
            _mark_failed(db, transcription, "Путь к аудиофайлу не задан в БД", item)
            logger.error("Audio path is None", transcription_id=transcription_id)
            return {"status": "failed", "transcription_id": transcription_id, "error": "audio_path is None"}

        if not os.path.exists(item.audio_path):
            _mark_failed(db, transcription, f"Аудиофайл не найден: {item.audio_path}", item)
            logger.error("Audio file not found", transcription_id=transcription_id, path=item.audio_path)
            return {"status": "failed", "transcription_id": transcription_id, "error": "file not found"}

        file_size = os.path.getsize(item.audio_path)
        if file_size == 0:
            _mark_failed(db, transcription, "Аудиофайл пустой (0 байт)", item)
            logger.error("Audio file is empty", transcription_id=transcription_id, path=item.audio_path)
            return {"status": "failed", "transcription_id": transcription_id, "error": "file is empty"}

        logger.info("Transcription started", transcription_id=transcription_id, audio_path=item.audio_path)

        # Run Whisper
        transcriber = WhisperTranscriber(settings.whisper_model_size)
        result = transcriber.transcribe(item.audio_path)

        # Normalize via Claude API
        item.processing_step = "Нормализация текста..."
        db.commit()

        normalized_text = result.text
        normalized_segments = result.segments
        if settings.anthropic_api_key:
            from app.integrations.claude_normalizer import TranscriptionNormalizer

            try:
                normalizer = TranscriptionNormalizer(settings.anthropic_api_key)
                normalized_text = normalizer.normalize_text(result.text)
                normalized_segments = normalizer.normalize_segments(result.segments)
                logger.info("Transcription normalized via Claude", transcription_id=transcription_id)
            except Exception as exc:
                logger.warning(
                    "Claude normalization failed, using original",
                    transcription_id=transcription_id,
                    error=str(exc),
                )

        # Save result — transcription is usable immediately
        transcription.text = normalized_text
        transcription.language = result.language
        transcription.duration_seconds = result.duration_seconds
        transcription.segments = normalized_segments
        transcription.whisper_model = settings.whisper_model_size
        transcription.status = TranscriptionStatus.COMPLETED
        transcription.error_message = None
        item.processing_step = None

        # Launch diarization as separate background task
        if settings.huggingface_token:
            from app.models.transcription import DiarizationStatus

            transcription.diarization_status = DiarizationStatus.PENDING
            db.commit()

            from app.worker.tasks.diarize_content import diarize_content_task

            task = diarize_content_task.delay(transcription_id)
            transcription.diarization_celery_task_id = task.id
            db.commit()
        else:
            db.commit()
            # No diarization needed — cleanup audio
            try:
                os.remove(item.audio_path)
                item.audio_path = None
                db.commit()
            except OSError:
                logger.warning("Failed to delete audio", path=item.audio_path)

        logger.info(
            "Transcription completed",
            transcription_id=transcription_id,
            language=result.language,
            duration=result.duration_seconds,
        )
        return {
            "status": "completed",
            "transcription_id": transcription_id,
            "language": result.language,
            "duration_seconds": result.duration_seconds,
        }

    except SoftTimeLimitExceeded:
        db.rollback()
        transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
        if transcription:
            ci = db.query(ContentItem).filter(ContentItem.id == transcription.content_item_id).first()
            _mark_failed(db, transcription, "Transcription timed out", ci)
        logger.error("Transcription timeout", transcription_id=transcription_id)
        return {"status": "failed", "transcription_id": transcription_id, "error": "timeout"}

    except WhisperError as exc:
        db.rollback()
        error_msg = str(exc)[:500]
        transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
        if transcription:
            ci = db.query(ContentItem).filter(ContentItem.id == transcription.content_item_id).first()
            transcription.retry_count += 1
            _mark_failed(db, transcription, error_msg, ci)
        logger.error("Whisper error, not retryable", transcription_id=transcription_id, error=error_msg)
        return {"status": "failed", "transcription_id": transcription_id, "error": error_msg}

    except Exception as exc:
        db.rollback()
        error_msg = str(exc)[:500]

        try:
            transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
            if transcription:
                ci = db.query(ContentItem).filter(ContentItem.id == transcription.content_item_id).first()
                transcription.retry_count += 1
                transcription.error_message = error_msg

                if self.request.retries >= MAX_RETRIES:
                    _mark_failed(db, transcription, error_msg, ci)
                    logger.error(
                        "Transcription failed permanently",
                        transcription_id=transcription_id,
                        error=error_msg,
                    )
                    return {"status": "failed", "transcription_id": transcription_id, "error": error_msg}

                db.commit()
        except Exception:
            db.rollback()

        logger.warning(
            "Transcription failed, retrying",
            transcription_id=transcription_id,
            retry=self.request.retries,
            error=error_msg,
        )
        raise self.retry(exc=exc, countdown=300 * (2**self.request.retries)) from exc

    finally:
        db.close()


def _mark_failed(db, transcription: Transcription, error_message: str, item: ContentItem | None = None) -> None:
    """Helper to mark transcription and content item as FAILED."""
    from app.models.content_item import ContentStatus

    try:
        transcription.status = TranscriptionStatus.FAILED
        transcription.error_message = error_message
        if item:
            item.status = ContentStatus.FAILED
            item.error_message = error_message
            item.processing_step = None
        db.commit()
    except Exception:
        db.rollback()
