from __future__ import annotations

from typing import Any

import httpx
import pytest


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------


async def test_register_success(client: httpx.AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "new@example.com", "password": "StrongPass1", "name": "New User"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


async def test_register_duplicate_email(client: httpx.AsyncClient, registered_user: dict[str, Any]) -> None:
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": registered_user["email"], "password": "AnotherPass1", "name": "Dup"},
    )
    assert resp.status_code == 409
    assert "already registered" in resp.json()["detail"].lower()


async def test_register_weak_password(client: httpx.AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "weak@example.com", "password": "short", "name": "Weak"},
    )
    assert resp.status_code == 422


async def test_register_invalid_email(client: httpx.AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "not-an-email", "password": "StrongPass1", "name": "Bad"},
    )
    assert resp.status_code == 422


async def test_register_email_normalized(client: httpx.AsyncClient) -> None:
    """Email is lowercased — registering UPPER@EXAMPLE.COM then login with upper@example.com works."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "UPPER@EXAMPLE.COM", "password": "StrongPass1", "name": "Upper"},
    )
    assert resp.status_code == 201

    # Login with lowercase should succeed
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "upper@example.com", "password": "StrongPass1"},
    )
    assert resp.status_code == 200


async def test_register_missing_name(client: httpx.AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "noname@example.com", "password": "StrongPass1"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


async def test_login_success(client: httpx.AsyncClient, registered_user: dict[str, Any]) -> None:
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body


async def test_login_wrong_password(client: httpx.AsyncClient, registered_user: dict[str, Any]) -> None:
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": "WrongPassword1"},
    )
    assert resp.status_code == 401
    assert "invalid" in resp.json()["detail"].lower()


async def test_login_nonexistent_email(client: httpx.AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "ghost@example.com", "password": "NoMatter123"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------


async def test_refresh_success(client: httpx.AsyncClient, registered_user: dict[str, Any]) -> None:
    refresh_token = registered_user["tokens"]["refresh_token"]
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body
    # New tokens should differ from original
    assert body["access_token"] != registered_user["tokens"]["access_token"]
    assert body["refresh_token"] != refresh_token


async def test_refresh_with_access_token(client: httpx.AsyncClient, registered_user: dict[str, Any]) -> None:
    """Using an access token for refresh should fail (wrong token type)."""
    access_token = registered_user["tokens"]["access_token"]
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": access_token})
    assert resp.status_code == 401
    assert "token type" in resp.json()["detail"].lower()


async def test_refresh_rotation_blacklists_old_token(
    client: httpx.AsyncClient, registered_user: dict[str, Any]
) -> None:
    """After refresh, the old refresh token must be blacklisted."""
    old_refresh = registered_user["tokens"]["refresh_token"]

    # First refresh — should succeed
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert resp.status_code == 200

    # Second refresh with same old token — should fail (blacklisted)
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert resp.status_code == 401
    assert "revoked" in resp.json()["detail"].lower()


async def test_refresh_invalid_token(client: httpx.AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": "garbage.token.value"})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------


async def test_logout_success(
    client: httpx.AsyncClient,
    registered_user: dict[str, Any],
    auth_headers: dict[str, str],
) -> None:
    refresh_token = registered_user["tokens"]["refresh_token"]
    resp = await client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_token},
        headers=auth_headers,
    )
    assert resp.status_code == 204


async def test_logout_refresh_blacklisted(
    client: httpx.AsyncClient,
    registered_user: dict[str, Any],
    auth_headers: dict[str, str],
) -> None:
    """After logout, the refresh token must not work for refresh."""
    refresh_token = registered_user["tokens"]["refresh_token"]

    # Logout
    resp = await client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_token},
        headers=auth_headers,
    )
    assert resp.status_code == 204

    # Try to refresh with the blacklisted token
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 401
    assert "revoked" in resp.json()["detail"].lower()


async def test_logout_requires_auth(client: httpx.AsyncClient) -> None:
    """Logout without Authorization header should fail."""
    resp = await client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": "doesnotmatter"},
    )
    assert resp.status_code == 403
