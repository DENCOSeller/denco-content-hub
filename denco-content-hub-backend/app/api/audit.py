"""Proxy endpoints for Staff Service audit logs."""

from __future__ import annotations

import json
from typing import Any

import httpx
import structlog
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.dependencies import get_current_user

logger = structlog.get_logger()

router = APIRouter(prefix="/platform/audit", tags=["audit"])

_STAFF_TIMEOUT = 10.0


def _extract_bearer_token(request: Request) -> str:
    """Extract raw Bearer token from request Authorization header."""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:]
    return ""


@router.get(
    "",
    summary="Platform audit logs (proxy to Staff Service)",
    status_code=200,
    responses={
        403: {"description": "Not a platform admin"},
        502: {"description": "Staff Service unavailable"},
    },
)
async def get_platform_audit_logs(
    request: Request,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    action: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    actor_id: int | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    current_user: Any = Depends(get_current_user),
) -> JSONResponse:
    """Proxy to Staff Service GET /api/v1/audit (platform_admin only).

    Staff Service handles permission checks — CH just forwards the request.
    """
    token = _extract_bearer_token(request)
    params: dict[str, Any] = {"skip": skip, "limit": limit}
    if action is not None:
        params["action"] = action
    if resource_type is not None:
        params["resource_type"] = resource_type
    if actor_id is not None:
        params["actor_id"] = actor_id
    if date_from is not None:
        params["date_from"] = date_from
    if date_to is not None:
        params["date_to"] = date_to

    url = f"{settings.staff_service_url}/api/v1/audit"
    try:
        async with httpx.AsyncClient(timeout=_STAFF_TIMEOUT) as client:
            resp = await client.get(
                url,
                params=params,
                headers={"Authorization": f"Bearer {token}"},
            )
        try:
            data = resp.json()
        except json.JSONDecodeError:
            logger.error(
                "Staff Service returned non-JSON response",
                url=url,
                status_code=resp.status_code,
            )
            return JSONResponse(
                status_code=502,
                content={"detail": "Staff Service returned invalid response"},
            )
        return JSONResponse(status_code=resp.status_code, content=data)
    except httpx.TimeoutException:
        logger.error("Staff Service audit request timed out", url=url)
        return JSONResponse(status_code=504, content={"detail": "Staff Service timeout"})
    except httpx.ConnectError:
        logger.error("Staff Service unreachable", url=url)
        return JSONResponse(status_code=502, content={"detail": "Staff Service unavailable"})
    except Exception:
        logger.error("Staff Service audit proxy error", url=url, exc_info=True)
        return JSONResponse(status_code=502, content={"detail": "Staff Service error"})


@router.get(
    "/organizations/{org_id}",
    summary="Organization audit logs (proxy to Staff Service)",
    status_code=200,
    responses={
        403: {"description": "Not an org admin/owner"},
        502: {"description": "Staff Service unavailable"},
    },
)
async def get_organization_audit_logs(
    org_id: int,
    request: Request,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    action: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    actor_id: int | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    current_user: Any = Depends(get_current_user),
) -> JSONResponse:
    """Proxy to Staff Service GET /api/v1/organizations/{org_id}/audit.

    Staff Service handles permission checks — CH just forwards the request.
    """
    token = _extract_bearer_token(request)
    params: dict[str, Any] = {"skip": skip, "limit": limit}
    if action is not None:
        params["action"] = action
    if resource_type is not None:
        params["resource_type"] = resource_type
    if actor_id is not None:
        params["actor_id"] = actor_id
    if date_from is not None:
        params["date_from"] = date_from
    if date_to is not None:
        params["date_to"] = date_to

    url = f"{settings.staff_service_url}/api/v1/organizations/{org_id}/audit"
    try:
        async with httpx.AsyncClient(timeout=_STAFF_TIMEOUT) as client:
            resp = await client.get(
                url,
                params=params,
                headers={"Authorization": f"Bearer {token}"},
            )
        try:
            data = resp.json()
        except json.JSONDecodeError:
            logger.error(
                "Staff Service returned non-JSON response",
                url=url,
                org_id=org_id,
                status_code=resp.status_code,
            )
            return JSONResponse(
                status_code=502,
                content={"detail": "Staff Service returned invalid response"},
            )
        return JSONResponse(status_code=resp.status_code, content=data)
    except httpx.TimeoutException:
        logger.error("Staff Service audit request timed out", url=url, org_id=org_id)
        return JSONResponse(status_code=504, content={"detail": "Staff Service timeout"})
    except httpx.ConnectError:
        logger.error("Staff Service unreachable", url=url, org_id=org_id)
        return JSONResponse(status_code=502, content={"detail": "Staff Service unavailable"})
    except Exception:
        logger.error("Staff Service audit proxy error", url=url, org_id=org_id, exc_info=True)
        return JSONResponse(status_code=502, content={"detail": "Staff Service error"})
