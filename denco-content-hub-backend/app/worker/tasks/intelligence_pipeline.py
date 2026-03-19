"""Content Intelligence pipeline — Celery tasks.

Entry-points:
- analyze_reference_intelligence(content_item_id) — on-demand
- analyze_competitor_post_intelligence(post_id) — on-demand
- analyze_competitor_batch_intelligence() — beat (every 30 min)
- analyze_trend_item_intelligence(trend_item_id) — on-demand
- analyze_trend_batch_intelligence() — beat (every 30 min)
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import structlog
from anthropic import APITimeoutError, AuthenticationError, BadRequestError, PermissionDeniedError, RateLimitError

from app.config import settings
from app.integrations.content_intelligence.analyzer import UnifiedAnalyzer
from app.integrations.content_intelligence.config import PROMPT_VERSION, get_sections

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.integrations.content_intelligence.schemas import IntelligenceResult
from app.models.competitor import CompetitorChannel, CompetitorPost
from app.models.content_intelligence import ContentIntelligence
from app.models.content_item import ContentItem, SourceType
from app.models.transcription import Transcription
from app.models.trend import TrendItem
from app.worker.celery_app import celery_app
from app.worker.db import SyncSessionLocal

logger = structlog.get_logger()

BATCH_SIZE = 20


def _dump_pydantic_list(items: list | None) -> list[dict] | None:
    """Serialize list of Pydantic models to list of dicts for JSONB."""
    if items is None:
        return None
    return [item.model_dump() for item in items]


def _run_intelligence_analysis(
    db: Session,
    *,
    source_type: str,
    source_id_field: str,
    source_id: int,
    workspace_id: int,
    text: str,
    metadata: dict,
) -> ContentIntelligence:
    """Core: create/update ContentIntelligence, run UnifiedAnalyzer, save."""
    # Upsert: find existing record
    record = db.query(ContentIntelligence).filter(getattr(ContentIntelligence, source_id_field) == source_id).first()
    if not record:
        record = ContentIntelligence(
            workspace_id=workspace_id,
            source_type=source_type,
            **{source_id_field: source_id},
        )
        db.add(record)

    record.status = "processing"
    record.error_message = None
    db.commit()

    # Determine sections
    is_video = bool(metadata.get("duration"))
    sections = get_sections(source_type, is_video=is_video)

    analyzer = UnifiedAnalyzer()
    result: IntelligenceResult = analyzer.analyze(
        text=text,
        metadata=metadata,
        sections=sections,
    )

    # Check if skipped (empty result = text too short)
    if result.summary is None and result.quality_score is None:
        record.status = "skipped"
        record.model_used = settings.ai_model
        record.prompt_version = PROMPT_VERSION
        record.sections_requested = sections
        db.commit()
        return record

    # Map IntelligenceResult → ContentIntelligence
    record.summary = result.summary
    record.key_points = _dump_pydantic_list(result.key_points)
    record.hooks = _dump_pydantic_list(result.hooks)
    record.topics = _dump_pydantic_list(result.topics)
    record.tone = result.tone
    record.quality_score = result.quality_score
    record.content_ideas = _dump_pydantic_list(result.content_ideas)
    record.content_structure = result.content_structure.model_dump() if result.content_structure else None
    record.storyboard = _dump_pydantic_list(result.storyboard)
    record.audience_insights = _dump_pydantic_list(result.audience_insights)
    record.production_notes = _dump_pydantic_list(result.production_notes)

    record.status = "completed"
    record.error_message = None
    record.model_used = settings.ai_model
    record.prompt_version = PROMPT_VERSION
    record.sections_requested = sections
    db.commit()

    logger.info(
        "Intelligence analysis completed",
        source_type=source_type,
        source_id=source_id,
        quality_score=result.quality_score,
    )
    return record


@celery_app.task(
    name="analyze_reference_intelligence",
    time_limit=300,
    soft_time_limit=280,
    autoretry_for=(RateLimitError, APITimeoutError),
    dont_autoretry_for=(BadRequestError, AuthenticationError, PermissionDeniedError),
    retry_backoff=True,
    max_retries=3,
)
def analyze_reference_intelligence(content_item_id: int) -> dict:
    """On-demand: анализ ContentItem через Content Intelligence."""
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
            logger.warning("ContentItem not found", content_item_id=content_item_id)
            return {"status": "skipped", "reason": "not_found"}

        # Get text: YouTube → transcription, others → extracted_text
        if item.source_type == SourceType.YOUTUBE_VIDEO:
            transcription = db.query(Transcription).filter(Transcription.content_item_id == content_item_id).first()
            text = transcription.text if transcription else None
        else:
            text = item.extracted_text

        if not text or not text.strip():
            # Mark as skipped
            record = (
                db.query(ContentIntelligence).filter(ContentIntelligence.content_item_id == content_item_id).first()
            )
            if not record:
                record = ContentIntelligence(
                    workspace_id=item.workspace_id,
                    source_type="reference",
                    content_item_id=content_item_id,
                )
                db.add(record)
            record.status = "skipped"
            record.error_message = "Нет текста для анализа"
            db.commit()
            logger.warning("No text for intelligence", content_item_id=content_item_id)
            return {"status": "skipped", "reason": "no_text"}

        is_youtube = item.source_type == SourceType.YOUTUBE_VIDEO
        metadata = {
            "source_type": "reference",
            "platform": item.source_type.value,
            "duration": item.duration if is_youtube else None,
            "has_timestamps": is_youtube,
        }

        record = _run_intelligence_analysis(
            db,
            source_type="reference",
            source_id_field="content_item_id",
            source_id=content_item_id,
            workspace_id=item.workspace_id,
            text=text,
            metadata=metadata,
        )
        return {"status": record.status, "content_item_id": content_item_id}

    except Exception as exc:
        db.rollback()
        error_msg = str(exc)[:500]
        try:
            record = (
                db.query(ContentIntelligence).filter(ContentIntelligence.content_item_id == content_item_id).first()
            )
            if record:
                record.status = "failed"
                record.error_message = error_msg
                db.commit()
        except Exception:
            db.rollback()
        logger.error(
            "Reference intelligence failed",
            content_item_id=content_item_id,
            error=error_msg,
        )
        raise

    finally:
        db.close()


@celery_app.task(
    name="analyze_competitor_batch_intelligence",
    time_limit=900,
    soft_time_limit=850,
    autoretry_for=(RateLimitError, APITimeoutError),
    dont_autoretry_for=(BadRequestError, AuthenticationError, PermissionDeniedError),
    retry_backoff=True,
    max_retries=3,
)
def analyze_competitor_batch_intelligence() -> dict[str, Any]:
    """Beat: берёт до 20 CompetitorPost (new), анализирует через Intelligence."""
    db = SyncSessionLocal()
    analyzed = 0
    errors = 0
    skipped = 0
    try:
        posts = (
            db.query(CompetitorPost)
            .join(CompetitorChannel, CompetitorPost.channel_id == CompetitorChannel.id)
            .filter(
                CompetitorPost.analysis_status == "new",
                CompetitorChannel.status == "active",
                CompetitorChannel.deleted_at.is_(None),
            )
            .order_by(CompetitorPost.published_at.desc())
            .limit(BATCH_SIZE)
            .all()
        )

        if not posts:
            logger.info("No competitor posts for intelligence analysis")
            return {"analyzed": 0, "errors": 0, "skipped": 0}

        logger.info("Starting intelligence batch", count=len(posts))

        for post in posts:
            try:
                _analyze_single_competitor(db, post)
                analyzed += 1
            except Exception as exc:
                errors += 1
                db.rollback()
                try:
                    db.refresh(post)
                    post.analysis_status = "failed"
                    post.analysis_error = str(exc)[:500]
                    db.commit()
                except Exception:
                    db.rollback()
                logger.error(
                    "Intelligence analysis failed for post",
                    post_id=post.id,
                    error=str(exc)[:200],
                )

        logger.info(
            "Intelligence batch completed",
            analyzed=analyzed,
            errors=errors,
            skipped=skipped,
        )
        return {"analyzed": analyzed, "errors": errors, "skipped": skipped}

    finally:
        db.close()


@celery_app.task(
    name="analyze_competitor_post_intelligence",
    time_limit=300,
    soft_time_limit=280,
    autoretry_for=(RateLimitError, APITimeoutError),
    dont_autoretry_for=(BadRequestError, AuthenticationError, PermissionDeniedError),
    retry_backoff=True,
    max_retries=3,
)
def analyze_competitor_post_intelligence(post_id: int) -> dict:
    """On-demand: анализ одного CompetitorPost через Content Intelligence."""
    db = SyncSessionLocal()
    try:
        post = db.query(CompetitorPost).filter(CompetitorPost.id == post_id).first()
        if not post:
            logger.warning("CompetitorPost not found", post_id=post_id)
            return {"status": "skipped", "reason": "not_found"}

        _analyze_single_competitor(db, post)
        return {"status": "completed", "post_id": post_id}

    except Exception as exc:
        db.rollback()
        error_msg = str(exc)[:500]
        try:
            record = db.query(ContentIntelligence).filter(ContentIntelligence.competitor_post_id == post_id).first()
            if record:
                record.status = "failed"
                record.error_message = error_msg
                db.commit()
        except Exception:
            db.rollback()
        logger.error(
            "Competitor post intelligence failed",
            post_id=post_id,
            error=error_msg,
        )
        raise

    finally:
        db.close()


def _analyze_single_competitor(db: Session, post: CompetitorPost) -> None:
    """Analyze one CompetitorPost via Intelligence pipeline."""
    # Build text from title + description
    parts = [post.title or "", post.description or ""]
    text = "\n\n".join(p for p in parts if p.strip())

    if not text.strip():
        post.analysis_status = "skipped"
        post.analysis_error = "Нет текста"
        db.commit()
        return

    # Get workspace_id and platform via channel
    channel = db.query(CompetitorChannel).filter(CompetitorChannel.id == post.channel_id).first()
    if not channel:
        post.analysis_status = "failed"
        post.analysis_error = "Channel not found"
        db.commit()
        return

    metadata = {
        "source_type": "competitor_post",
        "platform": channel.platform,
        "duration": post.duration_seconds,
        "has_timestamps": False,
    }

    _run_intelligence_analysis(
        db,
        source_type="competitor_post",
        source_id_field="competitor_post_id",
        source_id=post.id,
        workspace_id=channel.workspace_id,
        text=text,
        metadata=metadata,
    )

    post.analysis_status = "analyzed"
    post.analysis_error = None
    db.commit()

    logger.info("Competitor post intelligence done", post_id=post.id)


@celery_app.task(
    name="analyze_trend_item_intelligence",
    time_limit=300,
    soft_time_limit=280,
    autoretry_for=(RateLimitError, APITimeoutError),
    dont_autoretry_for=(BadRequestError, AuthenticationError, PermissionDeniedError),
    retry_backoff=True,
    max_retries=3,
)
def analyze_trend_item_intelligence(trend_item_id: int) -> dict:
    """On-demand: анализ одного TrendItem через Content Intelligence."""
    db = SyncSessionLocal()
    try:
        item = db.query(TrendItem).filter(TrendItem.id == trend_item_id).first()
        if not item:
            logger.warning("TrendItem not found", trend_item_id=trend_item_id)
            return {"status": "skipped", "reason": "not_found"}

        _analyze_single_trend_item(db, item)
        return {"status": "completed", "trend_item_id": trend_item_id}

    except Exception as exc:
        db.rollback()
        error_msg = str(exc)[:500]
        try:
            record = db.query(ContentIntelligence).filter(ContentIntelligence.trend_item_id == trend_item_id).first()
            if record:
                record.status = "failed"
                record.error_message = error_msg
                db.commit()
        except Exception:
            db.rollback()
        logger.error(
            "Trend item intelligence failed",
            trend_item_id=trend_item_id,
            error=error_msg,
        )
        raise

    finally:
        db.close()


@celery_app.task(
    name="analyze_trend_batch_intelligence",
    time_limit=900,
    soft_time_limit=850,
    autoretry_for=(RateLimitError, APITimeoutError),
    dont_autoretry_for=(BadRequestError, AuthenticationError, PermissionDeniedError),
    retry_backoff=True,
    max_retries=3,
)
def analyze_trend_batch_intelligence() -> dict[str, Any]:
    """Beat: берёт до 20 TrendItem (new), анализирует через Intelligence."""
    db = SyncSessionLocal()
    analyzed = 0
    errors = 0
    skipped = 0
    try:
        items = (
            db.query(TrendItem)
            .filter(TrendItem.analysis_status == "new")
            .order_by(TrendItem.detected_at.desc())
            .limit(BATCH_SIZE)
            .all()
        )

        if not items:
            logger.info("No trend items for intelligence analysis")
            return {"analyzed": 0, "errors": 0, "skipped": 0}

        logger.info("Starting trend intelligence batch", count=len(items))

        for item in items:
            try:
                _analyze_single_trend_item(db, item)
                analyzed += 1
            except Exception as exc:
                errors += 1
                db.rollback()
                try:
                    db.refresh(item)
                    item.analysis_status = "failed"
                    db.commit()
                except Exception:
                    db.rollback()
                logger.error(
                    "Intelligence analysis failed for trend item",
                    trend_item_id=item.id,
                    error=str(exc)[:200],
                )

        logger.info(
            "Trend intelligence batch completed",
            analyzed=analyzed,
            errors=errors,
            skipped=skipped,
        )
        return {"analyzed": analyzed, "errors": errors, "skipped": skipped}

    finally:
        db.close()


def _analyze_single_trend_item(db: Session, item: TrendItem) -> None:
    """Analyze one TrendItem via Intelligence pipeline."""
    parts = [item.title or "", item.description or ""]
    text = "\n\n".join(p for p in parts if p.strip())

    if not text.strip():
        item.analysis_status = "skipped"
        db.commit()
        return

    metadata = {
        "source_type": "trend_item",
        "platform": item.platform,
        "duration": item.duration_seconds,
        "has_timestamps": False,
        "channel_name": item.channel_name,
        "views": item.views_count,
        "likes": item.likes_count,
        "viral_score": item.viral_score,
        "stage": item.stage,
    }

    _run_intelligence_analysis(
        db,
        source_type="trend_item",
        source_id_field="trend_item_id",
        source_id=item.id,
        workspace_id=item.workspace_id,
        text=text,
        metadata=metadata,
    )

    item.analysis_status = "analyzed"
    db.commit()

    logger.info("Trend item intelligence done", trend_item_id=item.id)
