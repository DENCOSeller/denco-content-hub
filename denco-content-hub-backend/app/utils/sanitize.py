"""Утилиты для маскировки секретов в логах и трейсбеках."""

from __future__ import annotations

import re


def mask_url_secrets(text: str) -> str:
    """Маскирует API ключи и токены в URL-параметрах.

    Заменяет значения параметров key=, access_token=, api_key=, token=
    на первые 8 символов + '***'.

    >>> mask_url_secrets("key=AIzaSyB1234567890abcdef&q=test")
    'key=AIzaSyB1***&q=test'
    """
    return re.sub(
        r"((?:key|access_token|api_key|token)=)([^&\s'\"]{8})[^&\s'\"]*",
        r"\1\2***",
        text,
        flags=re.IGNORECASE,
    )
