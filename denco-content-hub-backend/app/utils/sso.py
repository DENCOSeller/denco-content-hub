"""SSO integration with Staff Service and Client IdP via denco-auth-sdk.

Uses MultiIssuerValidator for dual IdP support (Staff + Client).
"""

from __future__ import annotations

from denco_auth import AuthPayload, MultiIssuerValidator

from app.config import settings

_validator = MultiIssuerValidator(
    issuers={
        settings.staff_issuer: settings.staff_jwks_url,
        settings.client_issuer: settings.client_jwks_url,
    },
    product_code="content_hub",
    jwks_ttl=settings.staff_jwks_refresh_seconds,
    require_product_access=False,
    default_issuer=settings.staff_issuer,
)


async def fetch_jwks() -> None:
    """Pre-warm JWKS cache at startup."""
    for cache in _validator._cache._caches.values():
        await cache._refresh()


async def decode_sso_token(token: str) -> dict | None:
    """Decode and validate an SSO RS256 JWT token from any configured IdP.

    Returns decoded payload dict if valid, None if not an SSO token.
    Raises JWTError for tokens that ARE SSO but invalid/expired.
    """
    payload: AuthPayload | None = await _validator.validate(token)
    if payload is None:
        return None
    return payload.raw


async def validate_sso_token(token: str) -> AuthPayload | None:
    """Validate SSO token and return structured AuthPayload.

    Returns AuthPayload if valid, None if not an SSO token.
    Raises JWTError for tokens that ARE SSO but invalid/expired.
    """
    return await _validator.validate(token)
