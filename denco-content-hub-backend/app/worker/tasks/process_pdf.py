import structlog

from app.integrations.sources.pdf import PDFAdapter
from app.models.content_item import ContentItem, ContentStatus
from app.worker.celery_app import celery_app
from app.worker.db import SyncSessionLocal

logger = structlog.get_logger()


@celery_app.task(
    bind=True,
    name="process_pdf",
    max_retries=1,
    default_retry_delay=60,
    acks_late=True,
    time_limit=600,
    soft_time_limit=550,
)
def process_pdf_task(self, content_item_id: int) -> dict:
    """Extract text from a PDF file and save it to ContentItem.extracted_text."""
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
            logger.warning("Content item not found or deleted", content_item_id=content_item_id)
            return {"status": "skipped", "message": f"ContentItem {content_item_id} not found"}

        # Mark as processing
        item.status = ContentStatus.PROCESSING
        item.processing_step = "Извлечение текста из PDF..."
        db.commit()

        # Extract text via PDFAdapter
        adapter = PDFAdapter()
        data = {"file_path": item.raw_file_path}
        adapter.validate_input(data)
        extracted_text = adapter.extract_text(data)

        # Save result
        item.extracted_text = extracted_text
        item.status = ContentStatus.COMPLETED
        item.processing_step = None
        item.error_message = None
        db.commit()

        logger.info(
            "PDF processing completed",
            content_item_id=content_item_id,
            text_length=len(extracted_text),
        )
        return {
            "status": "completed",
            "content_item_id": content_item_id,
            "text_length": len(extracted_text),
        }

    except Exception as exc:
        db.rollback()
        error_msg = str(exc)[:500]

        try:
            item = (
                db.query(ContentItem)
                .filter(ContentItem.id == content_item_id)
                .first()
            )
            if item:
                item.status = ContentStatus.FAILED
                item.error_message = error_msg
                item.processing_step = None
                db.commit()
        except Exception:
            db.rollback()

        logger.error("PDF processing failed", content_item_id=content_item_id, error=error_msg)
        return {"status": "failed", "content_item_id": content_item_id, "error": error_msg}

    finally:
        db.close()
