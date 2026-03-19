"""YouTube Trend Discovery adapter — YouTube Data API v3.

Discovers trending videos by niche keywords and fetches regional trending.
Tracks API quota consumption (10,000 units/day free tier).

Quota costs:
- search.list = 100 units per call
- videos.list = 1 unit per call
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import httpx
import structlog

from app.config import settings

logger = structlog.get_logger()

BASE_URL = "https://www.googleapis.com/youtube/v3"
MAX_BATCH_SIZE = 50


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


def _parse_published_at(raw: str) -> datetime | None:
    """Parse ISO 8601 timestamp from YouTube API."""
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def _video_item_to_trend_dict(v: dict[str, Any]) -> dict[str, Any]:
    """Convert a YouTube videos.list item to TrendItem-compatible dict."""
    snippet = v.get("snippet", {})
    stats = v.get("statistics", {})
    content = v.get("contentDetails", {})
    video_id = v["id"] if isinstance(v["id"], str) else v["id"].get("videoId", "")

    channel_id = snippet.get("channelId", "")

    return {
        "platform": "youtube",
        "platform_post_id": video_id,
        "post_url": f"https://www.youtube.com/watch?v={video_id}",
        "title": snippet.get("title", "")[:1000],
        "description": snippet.get("description", "")[:5000],
        "thumbnail_url": (snippet.get("thumbnails", {}).get("high", {}) or {}).get("url"),
        "channel_name": snippet.get("channelTitle", ""),
        "channel_url": f"https://www.youtube.com/channel/{channel_id}" if channel_id else None,
        "duration_seconds": _parse_iso8601_duration(content.get("duration", "PT0S")),
        "published_at": _parse_published_at(snippet.get("publishedAt", "")),
        "views_count": int(stats.get("viewCount", 0)),
        "likes_count": int(stats.get("likeCount", 0)),
        "comments_count": int(stats.get("commentCount", 0)),
        "shares_count": 0,
        "raw_metadata": {
            "category_id": snippet.get("categoryId"),
            "tags": snippet.get("tags", []),
            "definition": content.get("definition"),
            "default_language": snippet.get("defaultLanguage"),
            "live_broadcast_content": snippet.get("liveBroadcastContent"),
        },
    }


@dataclass
class QuotaTracker:
    """Tracks YouTube API quota units consumed within a session."""

    units_consumed: int = 0

    def add(self, units: int, operation: str = "") -> None:
        self.units_consumed += units
        logger.info(
            "YouTube API quota",
            operation=operation,
            units=units,
            total_consumed=self.units_consumed,
        )


@dataclass
class YouTubeTrendDiscovery:
    """YouTube Trend Discovery adapter.

    Discovers trending videos by niche keywords and regional trending.
    All methods are synchronous — intended for Celery tasks.
    """

    timeout: int = 30
    quota: QuotaTracker = field(default_factory=QuotaTracker)

    def _client(self) -> httpx.Client:
        return httpx.Client(timeout=self.timeout)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def discover_by_niche(
        self,
        keywords: list[str],
        max_results: int = 50,
        published_after: datetime | None = None,
        relevance_language: str = "ru",
        region_code: str = "RU",
        order: str = "relevance",
    ) -> list[dict[str, Any]]:
        """Search YouTube for videos matching niche keywords.

        Uses search.list (100 units per call) followed by videos.list (1 unit per batch)
        to get full statistics.

        Args:
            keywords: List of search terms. Each keyword triggers a separate search.
            max_results: Maximum videos to return per keyword (capped at 50 by API).
            published_after: Only return videos published after this datetime.
            relevance_language: ISO 639-1 language code for relevance ranking.
            region_code: ISO 3166-1 alpha-2 country code for regional results.
            order: Sort order — "relevance" (default) or "date".

        Returns:
            List of dicts compatible with TrendItem fields.
        """
        api_key = _require_api_key()
        all_video_ids: list[str] = []
        seen_ids: set[str] = set()

        per_keyword = min(max_results, MAX_BATCH_SIZE)

        with self._client() as client:
            for keyword in keywords:
                params: dict[str, Any] = {
                    "key": api_key,
                    "q": keyword,
                    "part": "id",
                    "order": order,
                    "type": "video",
                    "maxResults": per_keyword,
                    "relevanceLanguage": relevance_language,
                    "regionCode": region_code,
                }
                if published_after:
                    params["publishedAfter"] = published_after.strftime("%Y-%m-%dT%H:%M:%SZ")

                resp = client.get(f"{BASE_URL}/search", params=params)
                resp.raise_for_status()
                self.quota.add(100, f"search.list q={keyword}")

                for item in resp.json().get("items", []):
                    vid = item.get("id", {}).get("videoId")
                    if vid and vid not in seen_ids:
                        seen_ids.add(vid)
                        all_video_ids.append(vid)

                logger.info(
                    "YouTube trend search",
                    keyword=keyword,
                    found=len(resp.json().get("items", [])),
                )

        if not all_video_ids:
            return []

        return self.fetch_video_stats(all_video_ids)

    def fetch_video_stats(self, video_ids: list[str]) -> list[dict[str, Any]]:
        """Fetch full video details and statistics in batches of 50.

        Args:
            video_ids: List of YouTube video IDs.

        Returns:
            List of dicts compatible with TrendItem fields.
        """
        api_key = _require_api_key()
        results: list[dict[str, Any]] = []

        with self._client() as client:
            for i in range(0, len(video_ids), MAX_BATCH_SIZE):
                batch = video_ids[i : i + MAX_BATCH_SIZE]
                resp = client.get(
                    f"{BASE_URL}/videos",
                    params={
                        "key": api_key,
                        "id": ",".join(batch),
                        "part": "snippet,statistics,contentDetails",
                    },
                )
                resp.raise_for_status()
                self.quota.add(1, f"videos.list batch={len(batch)}")

                for v in resp.json().get("items", []):
                    results.append(_video_item_to_trend_dict(v))

        logger.info(
            "YouTube: fetched video stats",
            requested=len(video_ids),
            received=len(results),
            quota_total=self.quota.units_consumed,
        )
        return results

    def get_trending(
        self,
        region: str = "RU",
        category: str | None = None,
        max_results: int = 50,
    ) -> list[dict[str, Any]]:
        """Fetch most popular videos for a region.

        Uses videos.list chart=mostPopular (1 unit per call).
        Note: mostPopular may be restricted in some regions/categories.

        Args:
            region: ISO 3166-1 alpha-2 country code.
            category: YouTube video category ID (e.g. "10" for Music). Optional.
            max_results: Number of results (max 50).

        Returns:
            List of dicts compatible with TrendItem fields.
        """
        api_key = _require_api_key()

        params: dict[str, Any] = {
            "key": api_key,
            "chart": "mostPopular",
            "regionCode": region,
            "part": "snippet,statistics,contentDetails",
            "maxResults": min(max_results, MAX_BATCH_SIZE),
        }
        if category:
            params["videoCategoryId"] = category

        with self._client() as client:
            resp = client.get(f"{BASE_URL}/videos", params=params)
            resp.raise_for_status()
            self.quota.add(1, f"videos.list chart=mostPopular region={region}")

        results = [_video_item_to_trend_dict(v) for v in resp.json().get("items", [])]

        logger.info(
            "YouTube: trending videos",
            region=region,
            category=category,
            count=len(results),
            quota_total=self.quota.units_consumed,
        )
        return results
