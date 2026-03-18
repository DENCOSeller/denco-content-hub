from __future__ import annotations

from typing import Any

import structlog
from anthropic import APIStatusError, APITimeoutError, RateLimitError

from app.integrations.competitor.ai_analyzer import analyze_competitor_post
from app.models.competitor import CompetitorChannel, CompetitorPost, CompetitorPostAnalysis
from app.worker.celery_app import celery_app
from app.worker.db import SyncSessionLocal

logger = structlog.get_logger()

BATCH_SIZE = 20


@celery_app.task(
    name="analyze_competitor_posts",
    time_limit=900,
    soft_time_limit=850,
    autoretry_for=(RateLimitError, APIStatusError, APITimeoutError),
    retry_backoff=True,
    max_retries=3,
)
def analyze_competitor_posts() -> dict[str, Any]:
    """Beat-задача: берёт новые посты без анализа, отправляет в Claude, сохраняет результат."""
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
            logger.info("No competitor posts to analyze")
            return {"analyzed": 0, "errors": 0, "skipped": 0}

        logger.info("Starting competitor post analysis", count=len(posts))

        for post in posts:
            try:
                _analyze_single_post(db, post)
                analyzed += 1
            except (ValueError, RuntimeError) as exc:
                skipped += 1
                post.analysis_status = "skipped"
                post.analysis_error = str(exc)[:500]
                db.commit()
                logger.warning(
                    "Competitor post skipped",
                    post_id=post.id,
                    reason=str(exc)[:200],
                )
            except Exception as exc:
                errors += 1
                db.rollback()
                db.refresh(post)
                post.analysis_status = "failed"
                post.analysis_error = str(exc)[:500]
                db.commit()
                logger.error(
                    "Competitor post analysis failed",
                    post_id=post.id,
                    error=str(exc)[:200],
                )

        logger.info(
            "Competitor post analysis batch completed",
            analyzed=analyzed,
            errors=errors,
            skipped=skipped,
        )
        return {"analyzed": analyzed, "errors": errors, "skipped": skipped}
    finally:
        db.close()


def _analyze_single_post(db: Any, post: CompetitorPost) -> None:
    """Анализирует один пост: вызывает Claude API и сохраняет CompetitorPostAnalysis."""
    post.analysis_status = "analyzing"
    db.commit()

    # Получаем платформу канала
    channel = db.query(CompetitorChannel).filter(CompetitorChannel.id == post.channel_id).first()
    platform = channel.platform if channel else "unknown"

    result = analyze_competitor_post(
        platform=platform,
        content_type=post.content_type,
        title=post.title,
        description=post.description,
        views=post.views_count,
        likes=post.likes_count,
        comments=post.comments_count,
        er_score=post.er_score,
    )

    # Создаём или обновляем запись анализа
    analysis = db.query(CompetitorPostAnalysis).filter(CompetitorPostAnalysis.post_id == post.id).first()
    if not analysis:
        analysis = CompetitorPostAnalysis(post_id=post.id)
        db.add(analysis)

    analysis.summary = result.get("summary")
    analysis.hooks = result.get("hooks")
    analysis.key_points = result.get("key_points")
    analysis.topics = result.get("topics")
    analysis.tone = result.get("tone")
    analysis.content_structure = result.get("content_structure")
    analysis.content_ideas = result.get("content_ideas")
    analysis.quality_score = result.get("quality_score")

    post.analysis_status = "analyzed"
    post.analysis_error = None
    db.commit()

    logger.info(
        "Competitor post analyzed",
        post_id=post.id,
        quality_score=result.get("quality_score"),
    )
