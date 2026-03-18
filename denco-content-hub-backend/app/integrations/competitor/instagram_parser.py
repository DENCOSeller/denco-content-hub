"""Instagram — парсер профиля конкурента через Apify Instagram Scraper."""

from __future__ import annotations

import contextlib
from datetime import UTC, datetime
from typing import Any

import structlog
from apify_client import ApifyClient

from app.config import settings

logger = structlog.get_logger()

MAX_POSTS = 50


def _require_api_key() -> str:
    key = settings.apify_api_key
    if not key:
        raise RuntimeError("APIFY_API_KEY не задан в .env")
    return key


def _get_client() -> ApifyClient:
    return ApifyClient(_require_api_key())


def fetch_channel_info(handle: str) -> dict[str, Any]:
    """Получить метаданные Instagram-профиля."""
    client = _get_client()

    try:
        run_input = {
            "usernames": [handle],
            "resultsType": "details",
            "resultsLimit": 1,
        }
        run = client.actor("apify/instagram-scraper").call(
            run_input=run_input, timeout_secs=120,
        )
        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
    except Exception:
        logger.exception("Instagram: ошибка получения профиля", handle=handle)
        return {
            "display_name": handle,
            "description": None,
            "avatar_url": None,
            "subscribers_count": None,
            "posts_count": None,
        }

    if not items:
        logger.warning("Instagram: профиль не найден", handle=handle)
        return {
            "display_name": handle,
            "description": None,
            "avatar_url": None,
            "subscribers_count": None,
            "posts_count": None,
        }

    profile = items[0]
    return {
        "display_name": profile.get("fullName") or handle,
        "description": (profile.get("biography") or "")[:2000] or None,
        "avatar_url": profile.get("profilePicUrl"),
        "subscribers_count": profile.get("followersCount"),
        "posts_count": profile.get("postsCount"),
    }


def fetch_latest_posts(
    handle: str,
    max_posts: int = MAX_POSTS,
) -> list[dict[str, Any]]:
    """Получить последние посты Instagram-профиля."""
    client = _get_client()

    try:
        run_input = {
            "usernames": [handle],
            "resultsType": "posts",
            "resultsLimit": max_posts,
        }
        run = client.actor("apify/instagram-scraper").call(
            run_input=run_input, timeout_secs=120,
        )
        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
    except Exception:
        logger.exception("Instagram: ошибка получения постов", handle=handle)
        return []

    results: list[dict[str, Any]] = []
    for post in items:
        post_id = post.get("id") or post.get("shortCode", "")

        # Дата публикации
        published_at = datetime.now(UTC)
        ts = post.get("timestamp")
        if ts:
            with contextlib.suppress(ValueError, AttributeError):
                published_at = datetime.fromisoformat(
                    str(ts).replace("Z", "+00:00"),
                )

        # Тип контента
        post_type = post.get("type", "").lower()
        if "video" in post_type:
            content_type = "video"
        elif "carousel" in post_type or "sidecar" in post_type:
            content_type = "carousel"
        else:
            content_type = "photo"

        shortcode = post.get("shortCode", "")

        results.append(
            {
                "platform_post_id": str(post_id),
                "post_url": f"https://www.instagram.com/p/{shortcode}/" if shortcode else None,
                "title": (post.get("caption") or "")[:200] or None,
                "description": (post.get("caption") or "")[:5000] or None,
                "thumbnail_url": post.get("displayUrl"),
                "duration_seconds": post.get("videoDuration"),
                "content_type": content_type,
                "published_at": published_at,
                "views_count": post.get("videoViewCount"),
                "likes_count": post.get("likesCount"),
                "comments_count": post.get("commentsCount"),
                "shares_count": None,
                "raw_metadata": {
                    "shortcode": shortcode,
                    "hashtags": post.get("hashtags", []),
                    "mentions": post.get("mentions", []),
                    "location": post.get("locationName"),
                },
            }
        )

    logger.info(
        "Instagram: получены посты",
        handle=handle,
        count=len(results),
    )
    return results
