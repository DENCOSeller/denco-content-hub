"""Celery задача — синхронизация каналов конкурентов."""

from __future__ import annotations

import traceback
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import and_

from app.models.competitor import (
    CompetitorChannel,
    CompetitorChannelSnapshot,
    CompetitorPost,
)
from app.worker.celery_app import celery_app
from app.worker.db import SyncSessionLocal

logger = structlog.get_logger()

DEFAULT_FREQUENCY_HOURS = 6

_ALLOWED_POST_FIELDS = {
    "platform_post_id",
    "post_url",
    "title",
    "description",
    "thumbnail_url",
    "duration_seconds",
    "content_type",
    "published_at",
    "views_count",
    "likes_count",
    "comments_count",
    "shares_count",
    "raw_metadata",
}


@celery_app.task(
    name="sync_competitor_channels",
    time_limit=1800,
    soft_time_limit=1700,
)
def sync_competitor_channels() -> dict[str, Any]:
    """Обход всех активных каналов, парсинг постов и снапшотов."""
    db = SyncSessionLocal()
    stats = {"synced": 0, "errors": 0, "new_posts": 0}

    try:
        channels = (
            db.query(CompetitorChannel)
            .filter(
                CompetitorChannel.status == "active",
                CompetitorChannel.deleted_at.is_(None),
            )
            .all()
        )

        for channel in channels:
            if not _needs_sync(channel):
                continue
            try:
                result = _sync_channel(db, channel)
                stats["synced"] += 1
                stats["new_posts"] += result["new_posts"]
            except Exception:
                stats["errors"] += 1
                _mark_channel_error(db, channel)
                logger.exception(
                    "Ошибка синхронизации канала",
                    channel_id=channel.id,
                    platform=channel.platform,
                )
    finally:
        db.close()

    logger.info("Синхронизация конкурентов завершена", **stats)
    return stats


@celery_app.task(
    name="sync_single_competitor_channel",
    time_limit=300,
    soft_time_limit=280,
)
def sync_single_competitor_channel(channel_id: int) -> dict[str, Any]:
    """Синхронизировать один конкретный канал (ручной запуск)."""
    db = SyncSessionLocal()
    channel = None
    try:
        channel = (
            db.query(CompetitorChannel)
            .filter(
                CompetitorChannel.id == channel_id,
                CompetitorChannel.deleted_at.is_(None),
            )
            .first()
        )
        if not channel:
            return {"error": f"Канал {channel_id} не найден"}

        result = _sync_channel(db, channel)
        return result
    except Exception:
        if channel:
            _mark_channel_error(db, channel)
        logger.exception(
            "Ошибка синхронизации канала",
            channel_id=channel_id,
        )
        raise
    finally:
        db.close()


@celery_app.task(
    name="take_channel_snapshots",
    time_limit=600,
    soft_time_limit=580,
)
def take_channel_snapshots() -> dict[str, Any]:
    """Ежедневный снапшот метрик для всех активных каналов."""
    db = SyncSessionLocal()
    stats = {"snapshots": 0, "errors": 0}

    try:
        channels = (
            db.query(CompetitorChannel)
            .filter(
                CompetitorChannel.status == "active",
                CompetitorChannel.deleted_at.is_(None),
            )
            .all()
        )

        threshold_30d = datetime.now(UTC) - timedelta(days=30)

        for channel in channels:
            try:
                posts_30d = (
                    db.query(CompetitorPost)
                    .filter(
                        CompetitorPost.channel_id == channel.id,
                        CompetitorPost.published_at >= threshold_30d,
                    )
                    .all()
                )

                views = [p.views_count for p in posts_30d if p.views_count is not None]
                total_views = sum(views) if views else None
                avg_views = total_views / len(views) if views else None

                er_values = [p.er_score for p in posts_30d if p.er_score is not None]
                avg_er = sum(er_values) / len(er_values) if er_values else None

                snapshot = CompetitorChannelSnapshot(
                    channel_id=channel.id,
                    subscribers_count=channel.subscribers_count,
                    posts_count=channel.posts_count,
                    avg_views_30d=avg_views,
                    avg_er_30d=avg_er,
                    total_views_30d=total_views,
                    posts_count_30d=len(posts_30d),
                )
                db.add(snapshot)
                stats["snapshots"] += 1
            except Exception:
                stats["errors"] += 1
                logger.exception(
                    "Ошибка создания снапшота",
                    channel_id=channel.id,
                )

        db.commit()
    finally:
        db.close()

    logger.info("Ежедневные снапшоты созданы", **stats)
    return stats


def _needs_sync(channel: CompetitorChannel) -> bool:
    """Проверить, пора ли парсить канал."""
    if not channel.last_parsed_at:
        return True
    freq = channel.parse_frequency_hours or DEFAULT_FREQUENCY_HOURS
    threshold = datetime.now(UTC) - timedelta(hours=freq)
    return channel.last_parsed_at < threshold


def _sync_channel(
    db: Any,
    channel: CompetitorChannel,
) -> dict[str, Any]:
    """Парсит канал, сохраняет посты и снапшот."""
    platform = channel.platform
    log = logger.bind(
        channel_id=channel.id,
        platform=platform,
        platform_id=channel.platform_id,
    )

    # --- Получить посты из парсера ---
    if platform == "youtube":
        from app.integrations.competitor.youtube_parser import (
            fetch_channel_info,
            fetch_latest_videos,
        )

        raw_posts = fetch_latest_videos(channel.platform_id)
        channel_info = fetch_channel_info(channel.platform_id)

    elif platform == "telegram":
        from app.integrations.competitor.telegram_parser import (
            fetch_channel_info,
            fetch_latest_posts,
        )

        handle = channel.handle or channel.platform_id
        raw_posts = fetch_latest_posts(handle)
        channel_info = fetch_channel_info(handle)

    elif platform == "instagram":
        from app.integrations.competitor.instagram_parser import (
            fetch_channel_info,
            fetch_latest_posts,
        )

        handle = channel.handle or channel.platform_id
        raw_posts = fetch_latest_posts(handle)
        channel_info = fetch_channel_info(handle)

    elif platform == "vk":
        from app.integrations.competitor.vk_parser import (
            fetch_channel_info,
            fetch_latest_posts,
        )

        pid = channel.platform_id
        raw_posts = fetch_latest_posts(pid)
        channel_info = fetch_channel_info(pid)
    else:
        log.warning("Платформа не поддерживается для парсинга")
        return {"new_posts": 0, "skipped": True}

    # --- Обновить метаданные канала ---
    if channel_info.get("display_name"):
        channel.display_name = channel_info["display_name"]
    if channel_info.get("description"):
        channel.description = channel_info["description"][:2000]
    if channel_info.get("avatar_url"):
        channel.avatar_url = channel_info["avatar_url"]
    if channel_info.get("subscribers_count") is not None:
        channel.subscribers_count = channel_info["subscribers_count"]
    if channel_info.get("posts_count") is not None:
        channel.posts_count = channel_info["posts_count"]

    # --- Сохранить новые посты (upsert по platform_post_id) ---
    new_posts_count = 0
    existing_ids = set(
        row[0]
        for row in db.query(CompetitorPost.platform_post_id).filter(CompetitorPost.channel_id == channel.id).all()
    )

    for post_data in raw_posts:
        if post_data["platform_post_id"] in existing_ids:
            # Обновить метрики существующего поста
            db.query(CompetitorPost).filter(
                and_(
                    CompetitorPost.channel_id == channel.id,
                    CompetitorPost.platform_post_id == post_data["platform_post_id"],
                )
            ).update(
                {
                    "views_count": post_data.get("views_count"),
                    "likes_count": post_data.get("likes_count"),
                    "comments_count": post_data.get("comments_count"),
                    "shares_count": post_data.get("shares_count"),
                }
            )
        else:
            filtered = {k: v for k, v in post_data.items() if k in _ALLOWED_POST_FIELDS}
            post = CompetitorPost(
                channel_id=channel.id,
                **filtered,
            )
            db.add(post)
            new_posts_count += 1

    # --- Создать снапшот канала ---
    threshold_30d = datetime.now(UTC) - timedelta(days=30)
    posts_last_30d = [p for p in raw_posts if p.get("published_at") and p["published_at"] >= threshold_30d]
    avg_views = _calc_avg_views(posts_last_30d)
    snapshot = CompetitorChannelSnapshot(
        channel_id=channel.id,
        subscribers_count=channel_info.get("subscribers_count"),
        posts_count=channel_info.get("posts_count"),
        avg_views_30d=avg_views,
        posts_count_30d=len(posts_last_30d),
    )
    db.add(snapshot)

    # --- Обновить статус канала ---
    channel.last_parsed_at = datetime.now(UTC)
    channel.last_error = None
    channel.error_count = 0
    channel.avg_views = avg_views

    db.commit()

    log.info(
        "Канал синхронизирован",
        new_posts=new_posts_count,
        total_fetched=len(raw_posts),
    )
    return {
        "new_posts": new_posts_count,
        "total_fetched": len(raw_posts),
    }


def _mark_channel_error(db: Any, channel: CompetitorChannel) -> None:
    """Пометить канал с ошибкой."""
    channel.error_count = (channel.error_count or 0) + 1
    channel.last_error = traceback.format_exc()[:2000]
    if channel.error_count >= 5:
        channel.status = "error"
    db.commit()


def _calc_avg_views(posts: list[dict[str, Any]]) -> float | None:
    """Средние просмотры по полученным постам."""
    views = [p["views_count"] for p in posts if p.get("views_count")]
    if not views:
        return None
    return sum(views) / len(views)
