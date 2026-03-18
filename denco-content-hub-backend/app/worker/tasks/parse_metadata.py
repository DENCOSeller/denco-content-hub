from datetime import UTC, datetime, time

import structlog
from celery.exceptions import SoftTimeLimitExceeded
from sqlalchemy.orm import Session

from app.config import settings
from app.integrations.youtube import YouTubeParseError, YouTubeParser
from app.models.content_item import ContentItem, ContentStatus
from app.worker.celery_app import celery_app
from app.worker.db import SyncSessionLocal

logger = structlog.get_logger()

MAX_RETRIES = 3


@celery_app.task(
    bind=True,
    name="parse_metadata",
    max_retries=MAX_RETRIES,
    default_retry_delay=60,
    acks_late=True,
    time_limit=300,
    soft_time_limit=270,
)
def parse_metadata_task(self, content_item_id: int) -> dict:
    """Parse content metadata and dispatch audio download.

    Flow: load item → PROCESSING → yt-dlp → update metadata → DOWNLOADING → dispatch download.
    Retries with exponential backoff: 60s, 120s, 240s.
    """
    db = SyncSessionLocal()
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
            logger.warning("Content item not found", content_item_id=content_item_id)
            return {"status": "error", "message": f"ContentItem {content_item_id} not found"}

        # Set PROCESSING
        item.status = ContentStatus.PROCESSING
        item.processing_step = "Парсинг метаданных..."
        db.commit()
        logger.info("Parsing started", content_item_id=content_item_id, url=item.url)

        # Parse metadata
        parser = YouTubeParser()
        metadata = parser.fetch_metadata(str(item.url))

        # Update metadata fields
        item.title = metadata.title
        item.description = metadata.description
        item.duration = metadata.duration_seconds
        item.video_id = metadata.video_id
        item.view_count = metadata.view_count
        item.like_count = metadata.like_count
        item.comment_count = metadata.comment_count
        item.channel_name = metadata.channel_name
        item.thumbnail_url = metadata.thumbnail_url
        item.published_at = (
            datetime.combine(metadata.upload_date, time.min, tzinfo=UTC) if metadata.upload_date else None
        )
        item.error_message = None

        # Check duration limit — skip audio pipeline for long videos
        if metadata.duration_seconds and metadata.duration_seconds > settings.max_video_duration_minutes * 60:
            item.status = ContentStatus.COMPLETED
            item.processing_step = None
            db.commit()
            logger.warning(
                "Video exceeds duration limit, skipping audio download",
                content_item_id=content_item_id,
                duration=metadata.duration_seconds,
                limit=settings.max_video_duration_minutes * 60,
            )
            return {"status": "completed", "skipped": "duration_limit"}

        # Set DOWNLOADING and dispatch next step
        item.status = ContentStatus.DOWNLOADING
        item.processing_step = None
        db.commit()

        from app.worker.tasks.download_audio import download_audio_task

        download_audio_task.delay(content_item_id)

        logger.info("Parsing completed, download dispatched", content_item_id=content_item_id, title=metadata.title)
        return {"status": "downloading", "content_item_id": content_item_id, "title": metadata.title}

    except SoftTimeLimitExceeded:
        db.rollback()
        _mark_failed(db, content_item_id, "Timeout: parsing took too long")
        logger.error("Parsing timeout", content_item_id=content_item_id)
        return {"status": "failed", "content_item_id": content_item_id, "error": "timeout"}

    except (YouTubeParseError, Exception) as exc:
        db.rollback()
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
                        "Parsing failed permanently",
                        content_item_id=content_item_id,
                        error=error_msg,
                    )
                    return {"status": "failed", "content_item_id": content_item_id, "error": error_msg}

                db.commit()
        except Exception:
            db.rollback()

        logger.warning(
            "Parsing failed, retrying",
            content_item_id=content_item_id,
            retry=self.request.retries,
            error=error_msg,
        )
        raise self.retry(exc=exc, countdown=60 * (2**self.request.retries)) from exc

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
