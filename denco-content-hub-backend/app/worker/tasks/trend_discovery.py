"""Celery задачи — Trend Discovery: обнаружение, мониторинг, алерты, очистка."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import and_, delete, update

from app.models.competitor import CompetitorPost
from app.models.trend import (
    TrendAlert,
    TrendItem,
    TrendNiche,
    TrendSnapshot,
)
from app.services.trend_scorer import TrendScorer
from app.worker.celery_app import celery_app
from app.worker.db import SyncSessionLocal

logger = structlog.get_logger()

scorer = TrendScorer()


def _run_async(coro: Any) -> Any:
    """Запуск async-функции из синхронного Celery таска."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _upsert_trend_item(
    db: Any,
    workspace_id: int,
    niche_id: int,
    post_data: dict[str, Any],
) -> TrendItem:
    """Создать или обновить TrendItem по platform + platform_post_id."""
    existing = (
        db.query(TrendItem)
        .filter(
            TrendItem.workspace_id == workspace_id,
            TrendItem.platform == post_data["platform"],
            TrendItem.platform_post_id == post_data["platform_post_id"],
        )
        .first()
    )

    if existing:
        existing.views_count = post_data.get("views_count", 0)
        existing.likes_count = post_data.get("likes_count", 0)
        existing.comments_count = post_data.get("comments_count", 0)
        existing.shares_count = post_data.get("shares_count", 0)
        if post_data.get("title"):
            existing.title = post_data["title"]
        if post_data.get("raw_metadata"):
            existing.raw_metadata = post_data["raw_metadata"]
        return existing

    item = TrendItem(
        workspace_id=workspace_id,
        niche_id=niche_id,
        platform=post_data["platform"],
        platform_post_id=post_data["platform_post_id"],
        post_url=post_data.get("post_url"),
        title=post_data.get("title"),
        description=post_data.get("description"),
        thumbnail_url=post_data.get("thumbnail_url"),
        channel_name=post_data.get("channel_name"),
        channel_url=post_data.get("channel_url"),
        duration_seconds=post_data.get("duration_seconds"),
        orientation=post_data.get("orientation"),
        published_at=post_data.get("published_at"),
        views_count=post_data.get("views_count", 0),
        likes_count=post_data.get("likes_count", 0),
        comments_count=post_data.get("comments_count", 0),
        shares_count=post_data.get("shares_count", 0),
        er_score=post_data.get("er_score"),
        raw_metadata=post_data.get("raw_metadata", {}),
    )
    db.add(item)
    return item


def _score_and_snapshot(
    db: Any,
    item: TrendItem,
) -> None:
    """Рассчитать scores через TrendScorer и создать TrendSnapshot."""
    last_snapshot = (
        db.query(TrendSnapshot)
        .filter(TrendSnapshot.trend_item_id == item.id)
        .order_by(TrendSnapshot.recorded_at.desc())
        .first()
    )

    age_hours = 0.0
    if item.published_at:
        delta = datetime.now(UTC) - item.published_at
        age_hours = max(0.0, delta.total_seconds() / 3600)

    current_metrics = {
        "views": item.views_count,
        "likes": item.likes_count,
        "comments": item.comments_count,
        "shares": item.shares_count,
        "age_hours": age_hours,
    }

    previous_metrics = None
    hours_elapsed = 0.0
    if last_snapshot:
        previous_metrics = {
            "views": last_snapshot.views_count or 0,
            "velocity": last_snapshot.velocity or 0.0,
        }
        delta_snap = datetime.now(UTC) - last_snapshot.recorded_at
        hours_elapsed = max(0.0, delta_snap.total_seconds() / 3600)

    result = scorer.score_trend(current_metrics, previous_metrics, hours_elapsed)

    item.velocity = result["velocity"]
    item.acceleration = result["acceleration"]
    item.er_score = result["er_score"]
    item.viral_score = result["viral_score"]
    item.stage = result["stage"]

    snapshot = TrendSnapshot(
        trend_item_id=item.id,
        views_count=item.views_count,
        likes_count=item.likes_count,
        comments_count=item.comments_count,
        velocity=result["velocity"],
        viral_score=result["viral_score"],
    )
    db.add(snapshot)


def _link_competitor_post(db: Any, item: TrendItem) -> None:
    """Попытка линковки TrendItem с CompetitorPost по platform_post_id."""
    if item.competitor_post_id:
        return
    cp = db.query(CompetitorPost).filter(CompetitorPost.platform_post_id == item.platform_post_id).first()
    if cp:
        item.competitor_post_id = cp.id


@celery_app.task(
    name="discover_trends_batch",
    time_limit=3600,
    soft_time_limit=3500,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    max_retries=2,
)
def discover_trends_batch() -> dict[str, Any]:
    """Обнаружение трендов по всем активным нишам (Beat: каждые 2 часа)."""
    db = SyncSessionLocal()
    stats: dict[str, Any] = {
        "niches_processed": 0,
        "new_items": 0,
        "updated_items": 0,
        "errors": 0,
        "warnings": 0,
    }

    try:
        niches = db.query(TrendNiche).filter(TrendNiche.is_active.is_(True)).all()

        for niche in niches:
            try:
                _process_niche(db, niche, stats)
                stats["niches_processed"] += 1
            except Exception:
                stats["errors"] += 1
                logger.exception(
                    "Ошибка обработки ниши",
                    niche_id=niche.id,
                    niche_name=niche.name,
                )

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("discover_trends_batch: критическая ошибка")
        raise
    finally:
        db.close()

    logger.info("Обнаружение трендов завершено", **stats)
    return stats


def _process_niche(
    db: Any,
    niche: TrendNiche,
    stats: dict[str, Any],
) -> None:
    """Обработка одной ниши: парсинг + upsert + scoring."""
    keywords = list(niche.keywords) if niche.keywords else []
    platforms = list(niche.platforms) if niche.platforms else []

    all_posts: list[dict[str, Any]] = []

    # Формируем keywords с учётом keyword_mode
    keyword_mode = getattr(niche, "keyword_mode", "separate") or "separate"
    yt_keywords = [" ".join(keywords)] if keyword_mode == "combined" and len(keywords) > 1 else keywords

    if "youtube" in platforms and keywords:
        from app.integrations.trend_discovery.youtube_trends import (
            YouTubeTrendDiscovery,
        )

        yt = YouTubeTrendDiscovery()
        published_after = datetime.now(UTC) - timedelta(hours=48)
        relevance_language = getattr(niche, "language", None) or "ru"
        region_code = getattr(niche, "region", None) or "RU"
        posts = yt.discover_by_niche(
            keywords=yt_keywords,
            max_results=50,
            published_after=published_after,
            relevance_language=relevance_language,
            region_code=region_code,
        )
        all_posts.extend(posts)

    if "instagram" in platforms and keywords:
        from app.integrations.trend_discovery.instagram_trends import (
            ApifyInstagramTrendProvider,
        )

        if not ApifyInstagramTrendProvider.check_configured():
            logger.warning(
                "Instagram discovery пропущен для ниши '%s': APIFY_API_KEY не задан в .env",
                niche.name,
                niche_id=niche.id,
            )
            stats["warnings"] += 1
        else:
            ig = ApifyInstagramTrendProvider()
            posts = _run_async(
                ig.discover_reels_by_keyword(
                    keywords=keywords,
                    max_results=50,
                )
            )
            all_posts.extend(posts)

    existing_count_before = (
        db.query(TrendItem)
        .filter(
            TrendItem.workspace_id == niche.workspace_id,
            TrendItem.niche_id == niche.id,
        )
        .count()
    )

    for post_data in all_posts:
        item = _upsert_trend_item(db, niche.workspace_id, niche.id, post_data)
        db.flush()
        _score_and_snapshot(db, item)
        _link_competitor_post(db, item)

    existing_count_after = (
        db.query(TrendItem)
        .filter(
            TrendItem.workspace_id == niche.workspace_id,
            TrendItem.niche_id == niche.id,
        )
        .count()
    )

    new_count = existing_count_after - existing_count_before
    stats["new_items"] += new_count
    stats["updated_items"] += len(all_posts) - new_count

    logger.info(
        "Ниша обработана",
        niche_id=niche.id,
        posts_fetched=len(all_posts),
        new=new_count,
    )


@celery_app.task(
    name="monitor_trend_snapshots",
    time_limit=1800,
    soft_time_limit=1700,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    max_retries=2,
)
def monitor_trend_snapshots() -> dict[str, Any]:
    """Мониторинг активных трендов — обновление метрик (Beat: каждые 4 часа)."""
    db = SyncSessionLocal()
    stats: dict[str, Any] = {"monitored": 0, "errors": 0}

    try:
        items = db.query(TrendItem).filter(TrendItem.stage.in_(["rising", "peaking"])).all()

        yt_items = [i for i in items if i.platform == "youtube"]
        other_items = [i for i in items if i.platform != "youtube"]

        # YouTube — батчевое обновление по 50
        if yt_items:
            _monitor_youtube_batch(db, yt_items, stats)

        # Остальные платформы — пересчёт по имеющимся данным
        for item in other_items:
            try:
                _score_and_snapshot(db, item)
                stats["monitored"] += 1
            except Exception:
                stats["errors"] += 1
                logger.exception(
                    "Ошибка мониторинга тренда",
                    trend_item_id=item.id,
                )

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("monitor_trend_snapshots: критическая ошибка")
        raise
    finally:
        db.close()

    logger.info("Мониторинг трендов завершён", **stats)
    return stats


def _monitor_youtube_batch(
    db: Any,
    items: list[TrendItem],
    stats: dict[str, Any],
) -> None:
    """Батчевое обновление YouTube трендов через fetch_video_stats."""
    from app.integrations.trend_discovery.youtube_trends import (
        YouTubeTrendDiscovery,
    )

    yt = YouTubeTrendDiscovery()
    video_ids = [i.platform_post_id for i in items]
    fresh_data = yt.fetch_video_stats(video_ids)

    fresh_map = {d["platform_post_id"]: d for d in fresh_data}

    for item in items:
        try:
            data = fresh_map.get(item.platform_post_id)
            if data:
                item.views_count = data.get("views_count", 0)
                item.likes_count = data.get("likes_count", 0)
                item.comments_count = data.get("comments_count", 0)
                item.shares_count = data.get("shares_count", 0)

            _score_and_snapshot(db, item)
            stats["monitored"] += 1
        except Exception:
            stats["errors"] += 1
            logger.exception(
                "Ошибка мониторинга YouTube тренда",
                trend_item_id=item.id,
            )


@celery_app.task(
    name="check_trend_alerts",
    time_limit=600,
    soft_time_limit=580,
)
def check_trend_alerts() -> dict[str, Any]:
    """Проверка и создание алертов по трендам (Beat: каждый час)."""
    db = SyncSessionLocal()
    stats: dict[str, Any] = {"viral_alerts": 0, "new_alerts": 0, "errors": 0}

    try:
        # Все workspace_id с активными нишами
        workspace_ids = [
            row[0] for row in db.query(TrendNiche.workspace_id).filter(TrendNiche.is_active.is_(True)).distinct().all()
        ]

        for ws_id in workspace_ids:
            try:
                _check_alerts_for_workspace(db, ws_id, stats)
            except Exception:
                stats["errors"] += 1
                logger.exception(
                    "Ошибка проверки алертов",
                    workspace_id=ws_id,
                )

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("check_trend_alerts: критическая ошибка")
        raise
    finally:
        db.close()

    logger.info("Проверка алертов завершена", **stats)
    return stats


def _check_alerts_for_workspace(
    db: Any,
    workspace_id: int,
    stats: dict[str, Any],
) -> None:
    """Создание алертов для одного workspace."""
    # ID трендов, у которых уже есть viral_trend алерт
    existing_viral_ids = set(
        row[0]
        for row in db.query(TrendAlert.trend_item_id)
        .filter(
            TrendAlert.workspace_id == workspace_id,
            TrendAlert.alert_type == "viral_trend",
        )
        .all()
        if row[0] is not None
    )

    # ID трендов, у которых уже есть new_trend алерт
    existing_new_ids = set(
        row[0]
        for row in db.query(TrendAlert.trend_item_id)
        .filter(
            TrendAlert.workspace_id == workspace_id,
            TrendAlert.alert_type == "new_trend",
        )
        .all()
        if row[0] is not None
    )

    # Viral: viral_score >= 70 без viral_trend алерта
    viral_items = (
        db.query(TrendItem)
        .filter(
            TrendItem.workspace_id == workspace_id,
            TrendItem.viral_score >= 70,
        )
        .all()
    )
    for item in viral_items:
        if item.id in existing_viral_ids:
            continue
        alert = TrendAlert(
            workspace_id=workspace_id,
            niche_id=item.niche_id,
            trend_item_id=item.id,
            alert_type="viral_trend",
            title=f"Вирусный тренд: {item.title or item.platform_post_id}",
            body=(f"Viral score: {item.viral_score}. Платформа: {item.platform}. Просмотры: {item.views_count}."),
            threshold_triggered={"viral_score": item.viral_score},
        )
        db.add(alert)
        stats["viral_alerts"] += 1

    # New trend: viral_score >= 40 без new_trend алерта
    new_items = (
        db.query(TrendItem)
        .filter(
            TrendItem.workspace_id == workspace_id,
            TrendItem.viral_score >= 40,
        )
        .all()
    )
    for item in new_items:
        if item.id in existing_new_ids:
            continue
        # Не дублируем, если уже есть viral алерт
        if item.id in existing_viral_ids:
            continue
        alert = TrendAlert(
            workspace_id=workspace_id,
            niche_id=item.niche_id,
            trend_item_id=item.id,
            alert_type="new_trend",
            title=f"Новый тренд: {item.title or item.platform_post_id}",
            body=(f"Viral score: {item.viral_score}. Платформа: {item.platform}. Просмотры: {item.views_count}."),
            threshold_triggered={"viral_score": item.viral_score},
        )
        db.add(alert)
        stats["new_alerts"] += 1


@celery_app.task(
    name="cleanup_old_trends",
    time_limit=600,
    soft_time_limit=580,
)
def cleanup_old_trends() -> dict[str, Any]:
    """Очистка устаревших данных трендов (Beat: раз в день)."""
    db = SyncSessionLocal()
    stats: dict[str, Any] = {
        "snapshots_deleted": 0,
        "items_declined": 0,
        "alerts_deleted": 0,
    }

    try:
        now = datetime.now(UTC)

        # Удалить TrendSnapshot старше 90 дней
        threshold_90d = now - timedelta(days=90)
        result = db.execute(
            delete(TrendSnapshot).where(
                TrendSnapshot.recorded_at < threshold_90d,
            )
        )
        stats["snapshots_deleted"] = result.rowcount

        # Пометить TrendItem старше 30 дней как declining
        threshold_30d = now - timedelta(days=30)
        result = db.execute(
            update(TrendItem)
            .where(
                and_(
                    TrendItem.detected_at < threshold_30d,
                    TrendItem.stage != "declining",
                )
            )
            .values(stage="declining")
        )
        stats["items_declined"] = result.rowcount

        # Удалить прочитанные TrendAlert старше 30 дней
        result = db.execute(
            delete(TrendAlert).where(
                and_(
                    TrendAlert.is_read.is_(True),
                    TrendAlert.created_at < threshold_30d,
                )
            )
        )
        stats["alerts_deleted"] = result.rowcount

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("cleanup_old_trends: критическая ошибка")
        raise
    finally:
        db.close()

    logger.info("Очистка трендов завершена", **stats)
    return stats
