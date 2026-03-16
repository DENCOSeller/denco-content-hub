from __future__ import annotations

from typing import Any

import httpx


async def test_get_me_success(
    client: httpx.AsyncClient,
    registered_user: dict[str, Any],
    auth_headers: dict[str, str],
) -> None:
    resp = await client.get("/api/v1/users/me", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == registered_user["email"]
    assert body["name"] == registered_user["name"]
    assert body["is_active"] is True
    assert "hashed_password" not in body
    assert "id" in body
    assert "created_at" in body


async def test_get_me_unauthorized(client: httpx.AsyncClient) -> None:
    """No token → 403 (HTTPBearer returns 403 by default)."""
    resp = await client.get("/api/v1/users/me")
    assert resp.status_code == 403
