"""YouTube Data API v3 — парсер канала конкурента."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

import httpx
import structlog

from app.config import settings

logger = structlog.get_logger()

BASE_URL = "https://www.googleapis.com/youtube/v3"
MAX_RESULTS = 50


def _require_api_key() -> str:
    key = settings.youtube_api_key
    if not key:
        raise RuntimeError("YOUTUBE_API_KEY не задан в .env")
    return key


def _parse_iso8601_duration(raw: str) -> int:
    """PT1H2M3S → секунды."""
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", raw)
    if not match:
        return 0
    h, m, s = (int(v or 0) for v in match.groups())
    return h * 3600 + m * 60 + s


def _resolve_channel_id(handle_or_id: str) -> str:
    """Резолвит @handle или username в реальный UC... channel ID."""
    if handle_or_id.startswith("UC") and len(handle_or_id) == 24:
        return handle_or_id

    api_key = _require_api_key()
    with httpx.Client(timeout=30) as client:
        if handle_or_id.startswith("@"):
            params = {"key": api_key, "forHandle": handle_or_id, "part": "id"}
        else:
            params = {"key": api_key, "forUsername": handle_or_id, "part": "id"}

        resp = client.get(f"{BASE_URL}/channels", params=params)
        resp.raise_for_status()
        items = resp.json().get("items", [])

    if not items:
        raise ValueError(f"YouTube канал не найден по handle: {handle_or_id}")

    resolved = items[0]["id"]
    logger.info("YouTube: resolved handle", handle=handle_or_id, channel_id=resolved)
    return resolved


def fetch_channel_info(channel_id: str) -> dict[str, Any]:
    """Получить метаданные YouTube-канала (sync)."""
    api_key = _require_api_key()
    channel_id = _resolve_channel_id(channel_id)
    with httpx.Client(timeout=30) as client:
        resp = client.get(
            f"{BASE_URL}/channels",
            params={
                "key": api_key,
                "id": channel_id,
                "part": "snippet,statistics",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    items = data.get("items", [])
    if not items:
        raise ValueError(f"YouTube канал не найден: {channel_id}")

    ch = items[0]
    snippet = ch.get("snippet", {})
    stats = ch.get("statistics", {})

    return {
        "display_name": snippet.get("title"),
        "description": snippet.get("description", "")[:2000],
        "avatar_url": (snippet.get("thumbnails") or {}).get("default", {}).get("url"),
        "subscribers_count": int(stats.get("subscriberCount", 0)),
        "posts_count": int(stats.get("videoCount", 0)),
    }


def fetch_latest_videos(
    channel_id: str,
    max_results: int = MAX_RESULTS,
) -> list[dict[str, Any]]:
    """Получить последние видео канала с метриками."""
    api_key = _require_api_key()
    channel_id = _resolve_channel_id(channel_id)

    with httpx.Client(timeout=30) as client:
        # 1. search — последние видео канала
        search_resp = client.get(
            f"{BASE_URL}/search",
            params={
                "key": api_key,
                "channelId": channel_id,
                "part": "id",
                "order": "date",
                "type": "video",
                "maxResults": max_results,
            },
        )
        search_resp.raise_for_status()
        search_data = search_resp.json()

        video_ids = [
            item["id"]["videoId"] for item in search_data.get("items", []) if item.get("id", {}).get("videoId")
        ]
        if not video_ids:
            return []

        # 2. videos — детали + метрики
        videos_resp = client.get(
            f"{BASE_URL}/videos",
            params={
                "key": api_key,
                "id": ",".join(video_ids),
                "part": "snippet,statistics,contentDetails",
            },
        )
        videos_resp.raise_for_status()
        videos_data = videos_resp.json()

    results: list[dict[str, Any]] = []
    for v in videos_data.get("items", []):
        snippet = v.get("snippet", {})
        stats = v.get("statistics", {})
        content = v.get("contentDetails", {})
        video_id = v["id"]

        published_raw = snippet.get("publishedAt", "")
        try:
            published_at = datetime.fromisoformat(published_raw.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            published_at = datetime.now(UTC)

        views = int(stats.get("viewCount", 0))
        likes = int(stats.get("likeCount", 0))
        comments = int(stats.get("commentCount", 0))

        results.append(
            {
                "platform_post_id": video_id,
                "post_url": f"https://www.youtube.com/watch?v={video_id}",
                "title": snippet.get("title", "")[:1000],
                "description": snippet.get("description", "")[:5000],
                "thumbnail_url": (snippet.get("thumbnails", {}).get("high", {}).get("url")),
                "duration_seconds": _parse_iso8601_duration(content.get("duration", "PT0S")),
                "content_type": "video",
                "published_at": published_at,
                "views_count": views,
                "likes_count": likes,
                "comments_count": comments,
                "shares_count": None,
                "raw_metadata": {
                    "category_id": snippet.get("categoryId"),
                    "tags": snippet.get("tags", []),
                    "definition": content.get("definition"),
                },
            }
        )

    logger.info(
        "YouTube: получены видео",
        channel_id=channel_id,
        count=len(results),
    )
    return results
