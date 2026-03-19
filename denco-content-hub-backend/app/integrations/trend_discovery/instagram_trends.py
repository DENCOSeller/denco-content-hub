"""Instagram Trend Discovery — поиск трендовых Reels через Apify.

Реализует абстрактный интерфейс TrendDiscoveryProvider для возможности
замены провайдера (Apify -> RapidAPI fallback).
"""

from __future__ import annotations

import abc
import contextlib
from datetime import UTC, datetime
from typing import Any

import structlog
from apify_client import ApifyClient

from app.config import settings

logger = structlog.get_logger()

# Apify actor для поиска Instagram контента по хештегам/ключевым словам
APIFY_HASHTAG_ACTOR = "apify/instagram-hashtag-scraper"
APIFY_SEARCH_ACTOR = "apify/instagram-scraper"
APIFY_TIMEOUT_SECS = 180


class TrendDiscoveryProvider(abc.ABC):
    """Абстрактный провайдер для поиска трендовых Reels.

    Позволяет менять источник данных (Apify, RapidAPI, etc.)
    без изменения бизнес-логики.
    """

    @abc.abstractmethod
    async def discover_reels_by_hashtag(
        self,
        hashtags: list[str],
        max_results: int = 50,
    ) -> list[dict[str, Any]]:
        """Поиск Reels по хештегам.

        Args:
            hashtags: Список хештегов для поиска (без #).
            max_results: Максимальное количество результатов.

        Returns:
            Список словарей в формате, совместимом с TrendItem.
        """

    @abc.abstractmethod
    async def discover_reels_by_keyword(
        self,
        keywords: list[str],
        max_results: int = 50,
    ) -> list[dict[str, Any]]:
        """Поиск Reels по ключевым словам.

        Args:
            keywords: Список ключевых слов для поиска.
            max_results: Максимальное количество результатов.

        Returns:
            Список словарей в формате, совместимом с TrendItem.
        """


def _require_api_key() -> str:
    key = settings.apify_api_key
    if not key:
        raise RuntimeError("APIFY_API_KEY не задан в .env")
    return key


def _get_client() -> ApifyClient:
    return ApifyClient(_require_api_key())


def _parse_timestamp(raw: Any) -> datetime:
    """Безопасный парсинг даты из ответа Apify."""
    if raw is None:
        return datetime.now(UTC)
    with contextlib.suppress(ValueError, AttributeError, TypeError):
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    return datetime.now(UTC)


def _calculate_er(likes: int, comments: int, shares: int, views: int) -> float | None:
    """Простой расчёт engagement rate для первичного скоринга."""
    if views <= 0:
        return None
    return round((likes + comments + shares) / views, 6)


def _normalize_post(post: dict[str, Any]) -> dict[str, Any] | None:
    """Преобразование сырых данных Apify в формат TrendItem.

    Пропускает не-video контент (нас интересуют только Reels).
    """
    post_type = (post.get("type") or "").lower()
    # Фильтруем: берём только видео (Reels)
    is_video = "video" in post_type or post.get("videoUrl") or post.get("videoDuration")
    if not is_video:
        return None

    post_id = post.get("id") or post.get("shortCode") or ""
    if not post_id:
        return None

    shortcode = post.get("shortCode", "")
    owner_username = post.get("ownerUsername") or post.get("ownerFullName") or ""

    views = int(post.get("videoViewCount") or post.get("videoPlayCount") or 0)
    likes = int(post.get("likesCount") or 0)
    comments = int(post.get("commentsCount") or 0)
    shares = 0  # Instagram API не отдаёт shares напрямую

    er_score = _calculate_er(likes, comments, shares, views)

    return {
        "platform": "instagram",
        "platform_post_id": str(post_id),
        "post_url": f"https://www.instagram.com/reel/{shortcode}/" if shortcode else None,
        "title": (post.get("caption") or "")[:1000] or None,
        "description": (post.get("caption") or "")[:5000] or None,
        "thumbnail_url": post.get("displayUrl"),
        "channel_name": owner_username or None,
        "channel_url": f"https://www.instagram.com/{owner_username}/" if owner_username else None,
        "duration_seconds": int(post["videoDuration"]) if post.get("videoDuration") else None,
        "orientation": "reels",
        "published_at": _parse_timestamp(post.get("timestamp")),
        "views_count": views,
        "likes_count": likes,
        "comments_count": comments,
        "shares_count": shares,
        "er_score": er_score,
        "raw_metadata": {
            "shortcode": shortcode,
            "hashtags": post.get("hashtags", []),
            "mentions": post.get("mentions", []),
            "location": post.get("locationName"),
            "music": post.get("musicInfo"),
        },
    }


class ApifyInstagramTrendProvider(TrendDiscoveryProvider):
    """Поиск трендовых Instagram Reels через Apify.

    Использует тот же Apify API ключ, что и competitor/instagram_parser.
    Стоимость: $0.50-2.60 за 1,000 результатов (pay-per-result).
    """

    def __init__(self, timeout_secs: int = APIFY_TIMEOUT_SECS) -> None:
        self._timeout_secs = timeout_secs

    @classmethod
    def check_configured(cls) -> bool:
        """Проверяет наличие APIFY_API_KEY без выброса исключения."""
        return bool(settings.apify_api_key)

    async def discover_reels_by_hashtag(
        self,
        hashtags: list[str],
        max_results: int = 50,
    ) -> list[dict[str, Any]]:
        """Поиск Reels по хештегам через Apify Instagram Hashtag Scraper.

        Использует actor apify/instagram-hashtag-scraper для поиска
        постов по конкретным хештегам. Результаты фильтруются — только видео (Reels).
        """
        if not hashtags:
            return []

        client = _get_client()
        # Нормализуем хештеги: убираем # если есть
        clean_tags = [tag.lstrip("#").strip() for tag in hashtags if tag.strip()]
        if not clean_tags:
            return []

        results_per_tag = max(1, max_results // len(clean_tags))

        all_results: list[dict[str, Any]] = []
        seen_ids: set[str] = set()

        for tag in clean_tags:
            try:
                run_input = {
                    "hashtags": [tag],
                    "resultsLimit": results_per_tag,
                    "resultsType": "posts",
                }
                run = client.actor(APIFY_HASHTAG_ACTOR).call(
                    run_input=run_input,
                    timeout_secs=self._timeout_secs,
                )
                items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
            except Exception:
                logger.exception(
                    "Instagram Trends: ошибка поиска по хештегу",
                    hashtag=tag,
                )
                continue

            for post in items:
                normalized = _normalize_post(post)
                if normalized is None:
                    continue
                pid = normalized["platform_post_id"]
                if pid in seen_ids:
                    continue
                seen_ids.add(pid)
                all_results.append(normalized)

        # Сортируем по просмотрам (самые популярные первыми)
        all_results.sort(key=lambda x: x["views_count"], reverse=True)

        logger.info(
            "Instagram Trends: найдены Reels по хештегам",
            hashtags=clean_tags,
            total_found=len(all_results),
            requested=max_results,
        )
        return all_results[:max_results]

    async def discover_reels_by_keyword(
        self,
        keywords: list[str],
        max_results: int = 50,
    ) -> list[dict[str, Any]]:
        """Поиск Reels по ключевым словам через Apify Instagram Scraper.

        Использует actor apify/instagram-scraper с searchType=hashtag
        для поиска по ключевым словам. Результаты фильтруются — только видео (Reels).
        """
        if not keywords:
            return []

        client = _get_client()
        clean_keywords = [kw.strip() for kw in keywords if kw.strip()]
        if not clean_keywords:
            return []

        results_per_keyword = max(1, max_results // len(clean_keywords))

        all_results: list[dict[str, Any]] = []
        seen_ids: set[str] = set()

        for keyword in clean_keywords:
            try:
                run_input = {
                    "search": keyword,
                    "searchType": "hashtag",
                    "resultsType": "posts",
                    "resultsLimit": results_per_keyword,
                }
                run = client.actor(APIFY_SEARCH_ACTOR).call(
                    run_input=run_input,
                    timeout_secs=self._timeout_secs,
                )
                items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
            except Exception:
                logger.exception(
                    "Instagram Trends: ошибка поиска по ключевому слову",
                    keyword=keyword,
                )
                continue

            for post in items:
                normalized = _normalize_post(post)
                if normalized is None:
                    continue
                pid = normalized["platform_post_id"]
                if pid in seen_ids:
                    continue
                seen_ids.add(pid)
                all_results.append(normalized)

        all_results.sort(key=lambda x: x["views_count"], reverse=True)

        logger.info(
            "Instagram Trends: найдены Reels по ключевым словам",
            keywords=clean_keywords,
            total_found=len(all_results),
            requested=max_results,
        )
        return all_results[:max_results]
