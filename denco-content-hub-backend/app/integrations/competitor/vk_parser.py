"""VK API — парсер группы/паблика конкурента."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx
import structlog

from app.config import settings
from app.integrations.competitor.vk_utils import extract_group_id

logger = structlog.get_logger()

BASE_URL = "https://api.vk.com/method"
API_VERSION = "5.199"
MAX_POSTS = 50


def _require_token() -> str:
    token = settings.vk_access_token
    if not token:
        raise RuntimeError("VK_ACCESS_TOKEN не задан в .env")
    return token


def _vk_request(method: str, params: dict[str, Any]) -> dict[str, Any]:
    """Выполнить запрос к VK API."""
    token = _require_token()
    params = {
        **params,
        "access_token": token,
        "v": API_VERSION,
    }
    with httpx.Client(timeout=30) as client:
        resp = client.get(f"{BASE_URL}/{method}", params=params)
        resp.raise_for_status()
        data = resp.json()

    if "error" in data:
        error_msg = data["error"].get("error_msg", "Unknown VK API error")
        raise RuntimeError(f"VK API error: {error_msg}")

    return data.get("response", {})


def _get_group_id(group_id_or_handle: str) -> int | None:
    return extract_group_id(_vk_request, group_id_or_handle)


def fetch_channel_info(group_id_or_handle: str) -> dict[str, Any]:
    """Получить информацию о VK-группе."""
    gid = _get_group_id(group_id_or_handle)
    if not gid:
        logger.warning(
            "VK: не удалось определить group_id",
            handle=group_id_or_handle,
        )
        return {
            "display_name": group_id_or_handle,
            "description": None,
            "avatar_url": None,
            "subscribers_count": None,
            "posts_count": None,
        }

    try:
        result = _vk_request(
            "groups.getById",
            {"group_id": gid, "fields": "description,members_count,counters,photo_200"},
        )
    except Exception:
        logger.exception("VK: ошибка получения группы", group_id=gid)
        return {
            "display_name": group_id_or_handle,
            "description": None,
            "avatar_url": None,
            "subscribers_count": None,
            "posts_count": None,
        }

    # groups.getById возвращает {"groups": [...]}
    groups = result.get("groups", []) if isinstance(result, dict) else result
    if isinstance(groups, list) and groups:
        group = groups[0]
    elif isinstance(result, list) and result:
        group = result[0]
    else:
        group = {}

    counters = group.get("counters", {})

    return {
        "display_name": group.get("name") or group_id_or_handle,
        "description": (group.get("description") or "")[:2000] or None,
        "avatar_url": group.get("photo_200"),
        "subscribers_count": group.get("members_count"),
        "posts_count": counters.get("posts"),
    }


def fetch_latest_posts(
    group_id_or_handle: str,
    max_posts: int = MAX_POSTS,
) -> list[dict[str, Any]]:
    """Получить последние посты со стены VK-группы."""
    gid = _get_group_id(group_id_or_handle)
    if not gid:
        logger.warning(
            "VK: не удалось определить group_id для постов",
            handle=group_id_or_handle,
        )
        return []

    try:
        result = _vk_request(
            "wall.get",
            {"owner_id": -gid, "count": max_posts},
        )
    except Exception:
        logger.exception("VK: ошибка получения постов", group_id=gid)
        return []

    items = result.get("items", [])
    results: list[dict[str, Any]] = []

    for post in items:
        post_id = post.get("id")
        owner_id = post.get("owner_id", -gid)

        # Дата публикации
        ts = post.get("date")
        published_at = datetime.fromtimestamp(ts, tz=UTC) if ts else datetime.now(UTC)

        # Текст поста
        text = post.get("text", "")

        # Метрики
        likes = (post.get("likes") or {}).get("count")
        reposts = (post.get("reposts") or {}).get("count")
        comments = (post.get("comments") or {}).get("count")
        views = (post.get("views") or {}).get("count")

        # Тип контента и миниатюра
        content_type = "text"
        thumbnail_url = None
        duration_seconds = None
        attachments = post.get("attachments", [])

        for att in attachments:
            att_type = att.get("type", "")
            if att_type == "video":
                content_type = "video"
                video = att.get("video", {})
                duration_seconds = video.get("duration")
                # Берём самую большую миниатюру
                images = video.get("image", [])
                if images:
                    thumbnail_url = images[-1].get("url")
                break
            if att_type == "photo":
                content_type = "photo"
                sizes = (att.get("photo") or {}).get("sizes", [])
                if sizes:
                    thumbnail_url = sizes[-1].get("url")

        results.append(
            {
                "platform_post_id": str(post_id),
                "post_url": f"https://vk.com/wall{owner_id}_{post_id}",
                "title": text[:200] if text else None,
                "description": text[:5000] if text else None,
                "thumbnail_url": thumbnail_url,
                "duration_seconds": duration_seconds,
                "content_type": content_type,
                "published_at": published_at,
                "views_count": views,
                "likes_count": likes,
                "comments_count": comments,
                "shares_count": reposts,
                "raw_metadata": {
                    "marked_as_ads": bool(post.get("marked_as_ads")),
                    "is_pinned": bool(post.get("is_pinned")),
                    "attachments_types": [a.get("type") for a in attachments],
                },
            }
        )

    logger.info(
        "VK: получены посты",
        group_id=gid,
        count=len(results),
    )
    return results
