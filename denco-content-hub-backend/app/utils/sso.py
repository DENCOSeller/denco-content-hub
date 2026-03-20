"""SSO integration with Staff Service (RS256 JWT validation).

Loads JWKS public keys from Staff Service and validates SSO tokens.
Falls back gracefully if Staff Service is unreachable at startup.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx
import structlog
from jose import JWTError, jwt
from jose.backends import RSAKey

from app.config import settings

logger = structlog.get_logger()

# Module-level cache for JWKS keys
_jwks_keys: dict[str, dict[str, Any]] = {}
_jwks_last_fetched: float = 0.0
_jwks_lock = asyncio.Lock()


async def fetch_jwks() -> None:
    """Fetch JWKS from Staff Service and cache the keys."""
    global _jwks_keys, _jwks_last_fetched

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(settings.staff_jwks_url)
            response.raise_for_status()
            data = response.json()

        keys: dict[str, dict[str, Any]] = {}
        for key_data in data.get("keys", []):
            kid = key_data.get("kid")
            if kid:
                keys[kid] = key_data

        _jwks_keys = keys
        _jwks_last_fetched = time.monotonic()
        logger.info("JWKS fetched from Staff Service", keys_count=len(keys))
    except Exception:
        logger.warning("Failed to fetch JWKS from Staff Service", url=settings.staff_jwks_url)


async def _ensure_jwks() -> None:
    """Ensure JWKS keys are loaded and fresh."""
    global _jwks_last_fetched

    elapsed = time.monotonic() - _jwks_last_fetched
    if _jwks_keys and elapsed < settings.staff_jwks_refresh_seconds:
        return

    async with _jwks_lock:
        # Double-check after acquiring lock
        elapsed = time.monotonic() - _jwks_last_fetched
        if _jwks_keys and elapsed < settings.staff_jwks_refresh_seconds:
            return
        await fetch_jwks()


def _get_public_key(kid: str) -> RSAKey | None:
    """Get cached RSA public key by kid."""
    key_data = _jwks_keys.get(kid)
    if not key_data:
        return None
    return RSAKey(key_data, algorithm="RS256")


async def decode_sso_token(token: str) -> dict[str, Any] | None:
    """Decode and validate an SSO RS256 JWT token from Staff Service.

    Returns decoded payload if valid, None if the token is not an SSO token
    (e.g. missing kid header, unknown kid, or RS256 validation fails).
    Raises JWTError only for tokens that ARE SSO tokens but are expired/invalid.
    """
    # Check if token has a kid header (SSO tokens always do)
    try:
        headers = jwt.get_unverified_headers(token)
    except JWTError:
        return None

    kid = headers.get("kid")
    if not kid:
        return None  # Not an SSO token

    # Ensure JWKS keys are loaded
    await _ensure_jwks()

    public_key = _get_public_key(kid)
    if not public_key:
        # Unknown kid — try refreshing JWKS once in case of key rotation
        await fetch_jwks()
        public_key = _get_public_key(kid)
        if not public_key:
            return None  # Still unknown — not our SSO token

    # This IS an SSO token (has matching kid). Decode strictly.
    payload = jwt.decode(
        token,
        public_key,
        algorithms=["RS256"],
        # TODO: включить verify_aud когда Staff Service начнёт отправлять aud claim
        options={"verify_aud": False},
    )

    # M2: отклоняем не-access токены (например refresh) при SSO
    if payload.get("type") != "access":
        return None

    return payload
