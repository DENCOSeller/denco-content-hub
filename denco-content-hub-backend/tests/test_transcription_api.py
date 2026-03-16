"""Integration tests for transcription API endpoints."""

from __future__ import annotations

import sys
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, patch

import pytest

from app.models.content_item import ContentItem, ContentStatus, SourceType
from app.models.transcription import Transcription, TranscriptionStatus

if TYPE_CHECKING:
    import httpx
    from sqlalchemy.ext.asyncio import AsyncSession


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BASE = "/api/v1/workspaces"


async def _setup_workspace(client: httpx.AsyncClient, auth_headers: dict[str, str]) -> int:
    """Create workspace, return workspace_id."""
    resp = await client.post(BASE, json={"name": "Test WS"}, headers=auth_headers)
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_content_directly(db: AsyncSession, workspace_id: int, user_id: int, **kw) -> ContentItem:
    defaults = {
        "workspace_id": workspace_id,
        "added_by_user_id": user_id,
        "url": "https://youtube.com/watch?v=abc12345678",
        "source_type": SourceType.YOUTUBE_VIDEO,
        "video_id": "abc12345678",
        "status": ContentStatus.COMPLETED,
    }
    defaults.update(kw)
    item = ContentItem(**defaults)
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def _create_transcription_directly(db: AsyncSession, content_id: int, **kw) -> Transcription:
    defaults = {
        "content_item_id": content_id,
        "status": TranscriptionStatus.COMPLETED,
        "text": "Transcribed text here",
        "language": "en",
        "duration_seconds": 60,
        "whisper_model": "small",
    }
    defaults.update(kw)
    t = Transcription(**defaults)
    db.add(t)
    await db.flush()
    await db.refresh(t)
    return t


async def _get_user_id(client: httpx.AsyncClient, auth_headers: dict[str, str]) -> int:
    resp = await client.get("/api/v1/users/me", headers=auth_headers)
    assert resp.status_code == 200
    return resp.json()["id"]


# ---------------------------------------------------------------------------
# GET /transcription
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_transcription_endpoint(
    client: httpx.AsyncClient,
    auth_headers: dict[str, str],
    registered_user: dict[str, Any],
    db_session: AsyncSession,
) -> None:
    ws_id = await _setup_workspace(client, auth_headers)
    user_id = await _get_user_id(client, auth_headers)
    content = await _create_content_directly(db_session, ws_id, user_id)
    trans = await _create_transcription_directly(db_session, content.id)
    await db_session.commit()

    resp = await client.get(
        f"{BASE}/{ws_id}/content/{content.id}/transcription",
        headers=auth_headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == trans.id
    assert body["content_item_id"] == content.id
    assert body["status"] == "completed"
    assert body["text"] == "Transcribed text here"
    assert body["language"] == "en"
    assert body["duration_seconds"] == 60
    assert body["whisper_model"] == "small"
    assert "created_at" in body
    assert "updated_at" in body


@pytest.mark.asyncio
async def test_get_transcription_404(
    client: httpx.AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    ws_id = await _setup_workspace(client, auth_headers)
    resp = await client.get(
        f"{BASE}/{ws_id}/content/9999/transcription",
        headers=auth_headers,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /transcription/retry
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_retry_transcription_endpoint(
    client: httpx.AsyncClient,
    auth_headers: dict[str, str],
    registered_user: dict[str, Any],
    db_session: AsyncSession,
) -> None:
    ws_id = await _setup_workspace(client, auth_headers)
    user_id = await _get_user_id(client, auth_headers)
    content = await _create_content_directly(db_session, ws_id, user_id, audio_path="/var/audio/test.wav")
    await _create_transcription_directly(
        db_session,
        content.id,
        status=TranscriptionStatus.FAILED,
        error_message="Whisper crashed",
        text=None,
    )
    await db_session.commit()

    mock_task_mod = MagicMock()
    mock_task_mod.transcribe_content_task.delay.return_value.id = "celery-retry-123"
    with patch.dict(sys.modules, {"app.worker.tasks.transcribe_content": mock_task_mod}):
        resp = await client.post(
            f"{BASE}/{ws_id}/content/{content.id}/transcription/retry",
            headers=auth_headers,
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "pending"
    assert body["error_message"] is None


@pytest.mark.asyncio
async def test_retry_transcription_not_failed(
    client: httpx.AsyncClient,
    auth_headers: dict[str, str],
    registered_user: dict[str, Any],
    db_session: AsyncSession,
) -> None:
    ws_id = await _setup_workspace(client, auth_headers)
    user_id = await _get_user_id(client, auth_headers)
    content = await _create_content_directly(db_session, ws_id, user_id)
    await _create_transcription_directly(db_session, content.id, status=TranscriptionStatus.COMPLETED)
    await db_session.commit()

    resp = await client.post(
        f"{BASE}/{ws_id}/content/{content.id}/transcription/retry",
        headers=auth_headers,
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Content list includes transcription
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_content_detail_includes_transcription(
    client: httpx.AsyncClient,
    auth_headers: dict[str, str],
    registered_user: dict[str, Any],
    db_session: AsyncSession,
) -> None:
    """Content detail response includes TranscriptionShortResponse."""
    ws_id = await _setup_workspace(client, auth_headers)
    user_id = await _get_user_id(client, auth_headers)
    content = await _create_content_directly(db_session, ws_id, user_id)
    await _create_transcription_directly(db_session, content.id, language="ru", duration_seconds=300)
    await db_session.commit()

    resp = await client.get(f"{BASE}/{ws_id}/content/{content.id}", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["transcription"] is not None
    assert body["transcription"]["status"] == "completed"
    assert body["transcription"]["language"] == "ru"
    assert body["transcription"]["duration_seconds"] == 300
