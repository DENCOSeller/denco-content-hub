import os

import structlog

from app.config import settings
from app.models.content_item import ContentItem
from app.models.transcription import DiarizationStatus, Transcription
from app.worker.celery_app import celery_app
from app.worker.db import SyncSessionLocal

logger = structlog.get_logger()


@celery_app.task(
    bind=True,
    name="diarize_content",
    max_retries=1,
    default_retry_delay=300,
    acks_late=True,
    time_limit=7200,
    soft_time_limit=7100,
)
def diarize_content_task(self, transcription_id: int) -> dict:
    """Assign speaker labels to transcription segments via pyannote.

    Runs as a separate background task after transcription is COMPLETED.
    """
    db = SyncSessionLocal()
    try:
        transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
        if not transcription:
            logger.warning("Transcription not found for diarization", transcription_id=transcription_id)
            return {"status": "skipped", "message": f"Transcription {transcription_id} not found"}

        item = (
            db.query(ContentItem)
            .filter(ContentItem.id == transcription.content_item_id, ContentItem.deleted_at.is_(None))
            .first()
        )
        if not item:
            logger.warning("Content item deleted, skipping diarization", transcription_id=transcription_id)
            return {"status": "skipped", "message": "Content item deleted"}

        if not item.audio_path or not os.path.exists(item.audio_path):
            transcription.diarization_status = DiarizationStatus.FAILED
            transcription.diarization_error = "Audio file not available for diarization"
            _cleanup_audio(item, db)
            db.commit()
            return {"status": "failed", "error": "audio not available"}

        if not transcription.segments:
            transcription.diarization_status = DiarizationStatus.FAILED
            transcription.diarization_error = "No segments to diarize"
            _cleanup_audio(item, db)
            db.commit()
            return {"status": "failed", "error": "no segments"}

        transcription.diarization_status = DiarizationStatus.PROCESSING
        db.commit()

        from app.integrations.diarizer import DiarizationError, SpeakerDiarizer

        diarizer = SpeakerDiarizer(settings.huggingface_token)  # type: ignore[arg-type]
        diarized_segments = diarizer.diarize(item.audio_path, transcription.segments)

        transcription.segments = diarized_segments
        transcription.diarization_status = DiarizationStatus.COMPLETED
        transcription.diarization_error = None
        db.commit()

        _cleanup_audio(item, db)

        logger.info("Diarization completed", transcription_id=transcription_id)
        return {"status": "completed", "transcription_id": transcription_id}

    except DiarizationError as exc:
        db.rollback()
        error_msg = str(exc)[:500]
        transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
        if transcription:
            transcription.diarization_status = DiarizationStatus.FAILED
            transcription.diarization_error = error_msg
            item = db.query(ContentItem).filter(ContentItem.id == transcription.content_item_id).first()
            _cleanup_audio(item, db)
            db.commit()
        logger.error("Diarization failed", transcription_id=transcription_id, error=error_msg)
        return {"status": "failed", "transcription_id": transcription_id, "error": error_msg}

    except Exception as exc:
        db.rollback()
        error_msg = str(exc)[:500]
        try:
            transcription = db.query(Transcription).filter(Transcription.id == transcription_id).first()
            if transcription:
                transcription.diarization_status = DiarizationStatus.FAILED
                transcription.diarization_error = error_msg
                item = db.query(ContentItem).filter(ContentItem.id == transcription.content_item_id).first()
                _cleanup_audio(item, db)
                db.commit()
        except Exception:
            db.rollback()
        logger.error("Diarization failed unexpectedly", transcription_id=transcription_id, error=error_msg)
        return {"status": "failed", "transcription_id": transcription_id, "error": error_msg}

    finally:
        db.close()


def _cleanup_audio(item: ContentItem | None, db) -> None:
    """Delete audio file after diarization (or on failure)."""
    if not item or not item.audio_path:
        return
    try:
        if os.path.exists(item.audio_path):
            os.remove(item.audio_path)
        item.audio_path = None
        db.commit()
    except OSError:
        logger.warning("Failed to delete audio after diarization", path=item.audio_path)
