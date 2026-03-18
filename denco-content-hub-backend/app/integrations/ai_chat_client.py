"""HTTP client for the AI Chat microservice."""

from __future__ import annotations

import contextlib
import json as _json
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

import httpx
from jose import jwt

from app.config import settings
from app.exceptions import AppException

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

_BASE_PATH = "/api/v1/chat"


def _make_ai_chat_jwt(user_id: int) -> str:
    """Create a short-lived JWT for service-to-service calls to AI Chat."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "product": "content_hub",
        "type": "service",
        "iat": now,
        "exp": now + timedelta(minutes=5),
    }
    return jwt.encode(payload, settings.ai_chat_jwt_secret, algorithm="HS256")


def _headers(user_id: int) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_make_ai_chat_jwt(user_id)}",
        "X-Service-Token": settings.ai_chat_service_secret,
    }


def _base_url() -> str:
    return settings.ai_chat_service_url.rstrip("/")


def _extract_detail(exc: httpx.HTTPStatusError) -> str:
    detail = "AI Chat service error"
    with contextlib.suppress(Exception):
        detail = exc.response.json().get("detail", detail)
    return detail


async def stream(
    user_id: int,
    message: str,
    session_id: int | None,
    scope: dict[str, Any],
    local_context: dict[str, Any],
    *,
    tools_enabled: bool = True,
) -> AsyncIterator[bytes]:
    """POST to AI Chat /stream and yield raw SSE bytes."""
    body = {
        "message": message,
        "session_id": session_id,
        "product_type": "content_hub",
        "scope": scope,
        "local_context": local_context,
        "tools_enabled": tools_enabled,
    }
    try:
        async with (
            httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client,
            client.stream(
                "POST",
                f"{_base_url()}{_BASE_PATH}/stream",
                headers=_headers(user_id),
                json=body,
            ) as resp,
        ):
            if resp.status_code >= 400:
                error_body = await resp.aread()
                detail = "AI Chat service error"
                with contextlib.suppress(Exception):
                    detail = _json.loads(error_body).get("detail", detail)
                raise AppException(detail, status_code=resp.status_code)
            async for chunk in resp.aiter_bytes():
                yield chunk
    except AppException:
        raise
    except httpx.RequestError as exc:
        raise AppException(
            f"AI Chat service unavailable: {exc}", status_code=502,
        ) from exc


async def get_sessions(
    user_id: int,
    scope_id: int,
    company_id: int,
) -> list[dict]:
    """GET chat sessions from AI Chat service."""
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            resp = await client.get(
                f"{_base_url()}{_BASE_PATH}/sessions",
                headers=_headers(user_id),
                params={
                    "product_type": "content_hub",
                    "scope_id": scope_id,
                    "company_id": company_id,
                },
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as exc:
        raise AppException(_extract_detail(exc), status_code=exc.response.status_code) from exc
    except httpx.RequestError as exc:
        raise AppException(
            f"AI Chat service unavailable: {exc}", status_code=502,
        ) from exc


async def delete_session(user_id: int, session_id: int) -> None:
    """DELETE a chat session."""
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            resp = await client.delete(
                f"{_base_url()}{_BASE_PATH}/sessions/{session_id}",
                headers=_headers(user_id),
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise AppException(_extract_detail(exc), status_code=exc.response.status_code) from exc
    except httpx.RequestError as exc:
        raise AppException(
            f"AI Chat service unavailable: {exc}", status_code=502,
        ) from exc


async def get_messages(user_id: int, session_id: int) -> list[dict]:
    """GET messages for a chat session."""
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            resp = await client.get(
                f"{_base_url()}{_BASE_PATH}/sessions/{session_id}/messages",
                headers=_headers(user_id),
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as exc:
        raise AppException(_extract_detail(exc), status_code=exc.response.status_code) from exc
    except httpx.RequestError as exc:
        raise AppException(
            f"AI Chat service unavailable: {exc}", status_code=502,
        ) from exc
