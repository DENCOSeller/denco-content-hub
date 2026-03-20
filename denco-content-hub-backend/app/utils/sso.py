"""SSO integration with Staff Service via denco-auth-sdk.

Thin wrapper around denco_auth.SSOValidator for backward compatibility.
"""

from __future__ import annotations

from typing import Any

from denco_auth import SSOValidator

from app.config import settings

_validator = SSOValidator(
    jwks_url=settings.staff_jwks_url,
    product_code="content_hub",
    jwks_ttl=settings.staff_jwks_refresh_seconds,
    require_product_access=False,
)


async def fetch_jwks() -> None:
    """Pre-warm JWKS cache at startup."""
    await _validator._cache._refresh()


async def decode_sso_token(token: str) -> dict[str, Any] | None:
    """Decode and validate an SSO RS256 JWT token from Staff Service.

    Returns decoded payload dict if valid, None if not an SSO token.
    Raises JWTError for tokens that ARE SSO but invalid/expired.
    """
    payload = await _validator.validate(token)
    if payload is None:
        return None
    return payload.raw
