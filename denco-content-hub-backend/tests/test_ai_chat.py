from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any
from unittest.mock import patch

import pytest

if TYPE_CHECKING:
    import httpx

BASE = "/api/v1/ai"

USER_DATA = {
    "email": "test@example.com",
    "password": "StrongPass123",
    "name": "Test User",
}

OWNER_DATA = {
    "email": "owner@example.com",
    "password": "StrongPass123",
    "name": "Platform Owner",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def register(client: httpx.AsyncClient, data: dict[str, str]) -> dict[str, Any]:
    resp = await client.post("/api/v1/auth/register", json=data)
    assert resp.status_code == 201
    return {"tokens": resp.json(), **data}


async def headers_for(user: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {user['tokens']['access_token']}"}


async def make_platform_owner(client: httpx.AsyncClient, db_session: Any) -> tuple[dict[str, Any], dict[str, str]]:
    """Register user and promote to platform owner via DB."""
    from sqlalchemy import update

    from app.models.user import User

    user = await register(client, OWNER_DATA)
    h = await headers_for(user)

    # Get user id from /me
    me = (await client.get("/api/v1/users/me", headers=h)).json()
    await db_session.execute(update(User).where(User.id == me["id"]).values(is_platform_owner=True))
    await db_session.commit()

    # Re-login to get fresh token with updated claims
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": OWNER_DATA["email"], "password": OWNER_DATA["password"]},
    )
    token = login_resp.json()["access_token"]
    return user, {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Sessions CRUD
# ---------------------------------------------------------------------------


async def test_create_session(client: httpx.AsyncClient) -> None:
    user = await register(client, USER_DATA)
    h = await headers_for(user)

    resp = await client.post(f"{BASE}/sessions", json={"title": "My Chat"}, headers=h)
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "My Chat"
    assert "id" in body
    assert "created_at" in body


async def test_list_sessions(client: httpx.AsyncClient) -> None:
    user = await register(client, USER_DATA)
    h = await headers_for(user)

    await client.post(f"{BASE}/sessions", json={"title": "Chat 1"}, headers=h)
    await client.post(f"{BASE}/sessions", json={"title": "Chat 2"}, headers=h)

    resp = await client.get(f"{BASE}/sessions", headers=h)
    assert resp.status_code == 200
    sessions = resp.json()
    assert len(sessions) == 2


async def test_get_messages_empty(client: httpx.AsyncClient) -> None:
    user = await register(client, USER_DATA)
    h = await headers_for(user)

    session = (await client.post(f"{BASE}/sessions", json={"title": "Empty"}, headers=h)).json()

    resp = await client.get(f"{BASE}/sessions/{session['id']}/messages", headers=h)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_messages_not_found(client: httpx.AsyncClient) -> None:
    user = await register(client, USER_DATA)
    h = await headers_for(user)

    resp = await client.get(f"{BASE}/sessions/999/messages", headers=h)
    assert resp.status_code == 404


async def test_delete_session(client: httpx.AsyncClient) -> None:
    user = await register(client, USER_DATA)
    h = await headers_for(user)

    session = (await client.post(f"{BASE}/sessions", json={"title": "To Delete"}, headers=h)).json()

    resp = await client.delete(f"{BASE}/sessions/{session['id']}", headers=h)
    assert resp.status_code == 204

    # Messages endpoint should return 404 for deleted session
    resp = await client.get(f"{BASE}/sessions/{session['id']}/messages", headers=h)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Settings (platform owner only)
# ---------------------------------------------------------------------------


async def test_get_settings_forbidden(client: httpx.AsyncClient) -> None:
    user = await register(client, USER_DATA)
    h = await headers_for(user)

    resp = await client.get(f"{BASE}/settings", headers=h)
    assert resp.status_code == 403


async def test_get_settings_platform_owner(client: httpx.AsyncClient, db_session: Any) -> None:
    _, h = await make_platform_owner(client, db_session)

    resp = await client.get(f"{BASE}/settings", headers=h)
    assert resp.status_code == 200
    body = resp.json()
    assert "ai_master_prompt" in body
    assert "ai_model" in body
    assert "ai_provider" in body


async def test_update_settings(client: httpx.AsyncClient, db_session: Any) -> None:
    _, h = await make_platform_owner(client, db_session)

    resp = await client.patch(f"{BASE}/settings", json={"ai_model": "claude-haiku-4-5-20251001"}, headers=h)
    assert resp.status_code == 200
    assert resp.json()["ai_model"] == "claude-haiku-4-5-20251001"

    # Verify persistence
    resp = await client.get(f"{BASE}/settings", headers=h)
    assert resp.json()["ai_model"] == "claude-haiku-4-5-20251001"


# ---------------------------------------------------------------------------
# SSE Chat Stream (mocked AI provider)
# ---------------------------------------------------------------------------


async def _fake_stream(*_args: Any, **_kwargs: Any):
    """Async generator yielding fake token chunks."""
    for token in ["Hello", " ", "world", "!"]:
        yield {"type": "text", "content": token}


async def test_chat_stream(client: httpx.AsyncClient) -> None:
    user = await register(client, USER_DATA)
    h = await headers_for(user)

    # Create session first
    session = (await client.post(f"{BASE}/sessions", json={"title": "Stream Test"}, headers=h)).json()

    with patch("app.services.chat_service._stream_anthropic", side_effect=_fake_stream):
        resp = await client.post(
            f"{BASE}/chat",
            json={"session_id": session["id"], "message": "Hi there"},
            headers=h,
        )

    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]

    # Parse SSE events
    lines = resp.text.strip().split("\n")
    events = [json.loads(line.removeprefix("data: ")) for line in lines if line.startswith("data: ")]

    token_events = [e for e in events if e["type"] == "token"]
    done_events = [e for e in events if e["type"] == "done"]

    assert len(token_events) == 4
    assert "".join(e["content"] for e in token_events) == "Hello world!"
    assert len(done_events) == 1
    assert done_events[0]["session_id"] == session["id"]
    assert "message_id" in done_events[0]


async def test_chat_stream_creates_session(client: httpx.AsyncClient) -> None:
    user = await register(client, USER_DATA)
    h = await headers_for(user)

    with patch("app.services.chat_service._stream_anthropic", side_effect=_fake_stream):
        resp = await client.post(
            f"{BASE}/chat",
            json={"message": "Create session automatically"},
            headers=h,
        )

    assert resp.status_code == 200
    lines = resp.text.strip().split("\n")
    events = [json.loads(line.removeprefix("data: ")) for line in lines if line.startswith("data: ")]

    done = [e for e in events if e["type"] == "done"]
    assert len(done) == 1
    assert "session_id" in done[0]

    # Verify session was created
    sessions = (await client.get(f"{BASE}/sessions", headers=h)).json()
    assert any(s["id"] == done[0]["session_id"] for s in sessions)
