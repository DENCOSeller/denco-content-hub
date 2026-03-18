"""VK — утилиты для определения group_id из URL/handle."""

from __future__ import annotations

from typing import Any

import structlog

logger = structlog.get_logger()


def resolve_screen_name(
    vk_request_fn: Any,
    handle: str,
) -> tuple[str, int] | None:
    """Преобразовать короткое имя в тип и id объекта."""
    try:
        result = vk_request_fn(
            "utils.resolveScreenName",
            {"screen_name": handle},
        )
    except Exception:
        logger.exception("VK: ошибка resolveScreenName", handle=handle)
        return None

    if not result or not result.get("object_id"):
        return None
    return result["type"], result["object_id"]


def extract_group_id(
    vk_request_fn: Any,
    group_id_or_handle: str,
) -> int | None:
    """Извлечь числовой group_id из handle или ID."""
    clean = group_id_or_handle.lstrip("-")

    # club123 / public123
    for prefix in ("club", "public"):
        if clean.startswith(prefix):
            try:
                return int(clean[len(prefix) :])
            except ValueError:
                pass

    # Числовой ID
    try:
        return int(clean)
    except ValueError:
        pass

    # Короткое имя — резолвим
    resolved = resolve_screen_name(vk_request_fn, clean)
    if resolved and resolved[0] in ("group", "page"):
        return resolved[1]

    return None
