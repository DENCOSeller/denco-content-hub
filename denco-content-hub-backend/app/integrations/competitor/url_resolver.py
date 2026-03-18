from __future__ import annotations

import re

from app.exceptions import BadRequestException
from app.models.competitor import CompetitorPlatform

_YOUTUBE_PATTERNS = [
    re.compile(r"(?:https?://)?(?:www\.)?youtube\.com/channel/(?P<id>UC[\w-]+)"),
    re.compile(r"(?:https?://)?(?:www\.)?youtube\.com/@(?P<handle>[\w.-]+)"),
    re.compile(r"(?:https?://)?(?:www\.)?youtube\.com/c/(?P<handle>[\w.-]+)"),
    re.compile(r"(?:https?://)?(?:www\.)?youtube\.com/user/(?P<handle>[\w.-]+)"),
]

_INSTAGRAM_PATTERN = re.compile(
    r"(?:https?://)?(?:www\.)?instagram\.com/(?!p/|reel/|reels/|stories/|tv/|explore/)(?P<handle>[\w.]+)/?$"
)

_TELEGRAM_PATTERN = re.compile(r"(?:https?://)?(?:t\.me|telegram\.me)/(?!s/|\+)(?P<handle>[\w]+)/?$")

_VK_PATTERNS = [
    re.compile(r"(?:https?://)?(?:www\.)?vk\.com/(?P<type>club|public)(?P<id>\d+)/?"),
    re.compile(r"(?:https?://)?(?:www\.)?vk\.com/(?P<handle>[\w.]+)/?"),
]


def resolve_url(url: str) -> tuple[CompetitorPlatform, str, str | None]:
    """Определяет платформу, platform_id и handle по URL.

    Returns:
        (platform, platform_id, handle)

    Raises:
        BadRequestException: если URL не распознан.
    """
    url = url.strip()

    # YouTube
    for pattern in _YOUTUBE_PATTERNS:
        m = pattern.match(url)
        if m:
            groups = m.groupdict()
            if groups.get("id"):
                return CompetitorPlatform.youtube, groups["id"], None
            handle = groups.get("handle", "")
            return CompetitorPlatform.youtube, f"@{handle}", handle

    # Instagram
    m = _INSTAGRAM_PATTERN.match(url)
    if m:
        handle = m.group("handle")
        return CompetitorPlatform.instagram, handle, handle

    # Telegram
    m = _TELEGRAM_PATTERN.match(url)
    if m:
        handle = m.group("handle")
        return CompetitorPlatform.telegram, handle, handle

    # VK
    for pattern in _VK_PATTERNS:
        m = pattern.match(url)
        if m:
            groups = m.groupdict()
            if "type" in groups and groups.get("id"):
                pid = f"{groups['type']}{groups['id']}"
                return CompetitorPlatform.vk, pid, None
            handle = groups.get("handle", "")
            return CompetitorPlatform.vk, handle, handle

    raise BadRequestException(f"Не удалось определить платформу по URL: {url}")
