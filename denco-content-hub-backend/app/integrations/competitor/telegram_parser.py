"""Telegram — парсер публичного канала через t.me/s/ preview."""

from __future__ import annotations

import contextlib
import re
from datetime import UTC, datetime
from typing import Any

import httpx
import structlog
from bs4 import BeautifulSoup

logger = structlog.get_logger()


def _parse_count(text: str | None) -> int | None:
    """'1.2K' → 1200, '3.5M' → 3500000."""
    if not text:
        return None
    text = text.strip().upper()
    multipliers = {"K": 1_000, "M": 1_000_000}
    for suffix, mult in multipliers.items():
        if text.endswith(suffix):
            try:
                return int(float(text[:-1]) * mult)
            except ValueError:
                return None
    try:
        return int(text)
    except ValueError:
        return None


def fetch_channel_info(handle: str) -> dict[str, Any]:
    """Получить базовую информацию о Telegram-канале."""
    url = f"https://t.me/s/{handle}"
    with httpx.Client(timeout=30, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    title_el = soup.select_one(".tgme_channel_info_header_title")
    desc_el = soup.select_one(".tgme_channel_info_description")
    avatar_el = soup.select_one(".tgme_channel_info_header img")
    counter_els = soup.select(".tgme_channel_info_counter .counter_value")

    subscribers = None
    if counter_els:
        subscribers = _parse_count(counter_els[0].get_text())

    return {
        "display_name": title_el.get_text(strip=True) if title_el else handle,
        "description": (desc_el.get_text(strip=True)[:2000] if desc_el else None),
        "avatar_url": avatar_el.get("src") if avatar_el else None,
        "subscribers_count": subscribers,
    }


def fetch_latest_posts(
    handle: str,
    max_posts: int = 50,
) -> list[dict[str, Any]]:
    """Спарсить последние посты публичного Telegram-канала."""
    url = f"https://t.me/s/{handle}"
    with httpx.Client(timeout=30, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    messages = soup.select(".tgme_widget_message_wrap")

    results: list[dict[str, Any]] = []

    for msg in messages[-max_posts:]:
        bubble = msg.select_one(".tgme_widget_message")
        if not bubble:
            continue

        data_post = bubble.get("data-post", "")
        if "/" not in data_post:
            continue
        post_id = data_post.split("/")[-1]

        # Текст поста
        text_el = bubble.select_one(".tgme_widget_message_text")
        text_content = text_el.get_text(strip=True) if text_el else ""

        # Дата
        time_el = bubble.select_one("time")
        published_at = datetime.now(UTC)
        if time_el and time_el.get("datetime"):
            with contextlib.suppress(ValueError, AttributeError):
                published_at = datetime.fromisoformat(time_el["datetime"].replace("Z", "+00:00"))

        # Просмотры
        views_el = bubble.select_one(".tgme_widget_message_views")
        views = _parse_count(views_el.get_text() if views_el else None)

        # Форварды (репосты)
        forward_el = bubble.select_one(".tgme_widget_message_forwards")
        forwards = _parse_count(forward_el.get_text() if forward_el else None)

        # Реакции — суммируем все
        reaction_els = bubble.select(".tgme_widget_message_reaction_count")
        total_reactions = 0
        for r_el in reaction_els:
            val = _parse_count(r_el.get_text())
            if val:
                total_reactions += val

        # Определяем тип контента
        content_type = "text"
        if bubble.select_one(".tgme_widget_message_video"):
            content_type = "video"
        elif bubble.select_one(".tgme_widget_message_photo"):
            content_type = "photo"
        elif bubble.select_one(".tgme_widget_message_document"):
            content_type = "document"

        # Миниатюра
        thumbnail_url = None
        photo_el = bubble.select_one(".tgme_widget_message_photo_wrap")
        if photo_el:
            style = photo_el.get("style", "")
            bg_match = re.search(r"url\(['\"]?(https?://[^'\")\s]+)", style)
            if bg_match:
                thumbnail_url = bg_match.group(1)

        # Заголовок = первые 200 символов текста
        title = text_content[:200] if text_content else None

        results.append(
            {
                "platform_post_id": post_id,
                "post_url": f"https://t.me/{handle}/{post_id}",
                "title": title,
                "description": text_content[:5000] if text_content else None,
                "thumbnail_url": thumbnail_url,
                "duration_seconds": None,
                "content_type": content_type,
                "published_at": published_at,
                "views_count": views,
                "likes_count": total_reactions or None,
                "comments_count": None,
                "shares_count": forwards,
                "raw_metadata": {},
            }
        )

    logger.info(
        "Telegram: получены посты",
        handle=handle,
        count=len(results),
    )
    return results
