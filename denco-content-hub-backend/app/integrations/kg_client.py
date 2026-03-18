"""HTTP client for the Knowledge Graph microservice."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from jose import jwt

from app.config import settings
from app.exceptions import AppException

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client  # noqa: PLW0603
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=settings.kg_service_url.rstrip("/") + "/api/v1",
            limits=httpx.Limits(
                max_connections=20,
                max_keepalive_connections=10,
            ),
            timeout=httpx.Timeout(10.0),
            follow_redirects=True,
        )
    return _client


def _make_service_jwt(user_id: int) -> str:
    """Create a short-lived JWT for service-to-service calls."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=5),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def _headers(user_id: int) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_make_service_jwt(user_id)}",
        "X-Service-Token": settings.kg_service_secret,
    }


async def _request(
    method: str,
    path: str,
    *,
    user_id: int,
    json: Any = None,
    params: dict[str, Any] | None = None,
) -> Any:
    """Send request to KG microservice; propagate errors as AppException."""
    client = _get_client()
    # Strip None values from params
    if params:
        params = {k: v for k, v in params.items() if v is not None}
    try:
        resp = await client.request(
            method,
            path,
            headers=_headers(user_id),
            json=json,
            params=params or None,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = "KG service error"
        try:
            body = exc.response.json()
            detail = body.get("detail", detail)
        except Exception:
            pass
        raise AppException(detail, status_code=exc.response.status_code) from exc
    except httpx.RequestError as exc:
        raise AppException(
            f"KG service unavailable: {exc}", status_code=502
        ) from exc

    if resp.status_code == 204:
        return None
    return resp.json()


# ---------------------------------------------------------------------------
# Nodes (scoped)
# ---------------------------------------------------------------------------


async def list_nodes(
    scope_type: str,
    scope_id: int,
    user_id: int,
    *,
    node_type_def_id: int | None = None,
    search: str | None = None,
) -> list[dict]:
    return await _request(
        "GET",
        f"/scopes/{scope_type}/{scope_id}/nodes",
        user_id=user_id,
        params={"node_type_def_id": node_type_def_id, "search": search},
    )


async def create_node(
    scope_type: str,
    scope_id: int,
    user_id: int,
    data: dict,
    *,
    company_scope_id: int | None = None,
) -> dict:
    return await _request(
        "POST",
        f"/scopes/{scope_type}/{scope_id}/nodes",
        user_id=user_id,
        json=data,
        params={"company_scope_id": company_scope_id},
    )


async def batch_update_positions(
    scope_type: str,
    scope_id: int,
    user_id: int,
    positions: list[dict],
) -> dict:
    return await _request(
        "PATCH",
        f"/scopes/{scope_type}/{scope_id}/nodes/positions",
        user_id=user_id,
        json={"positions": positions},
    )


# ---------------------------------------------------------------------------
# Nodes (direct)
# ---------------------------------------------------------------------------


async def get_node(node_id: int, user_id: int) -> dict:
    return await _request("GET", f"/nodes/{node_id}", user_id=user_id)


async def update_node(
    node_id: int,
    user_id: int,
    data: dict,
    *,
    company_scope_id: int | None = None,
) -> dict:
    return await _request(
        "PATCH",
        f"/nodes/{node_id}",
        user_id=user_id,
        json=data,
        params={"company_scope_id": company_scope_id},
    )


async def delete_node(node_id: int, user_id: int) -> None:
    await _request("DELETE", f"/nodes/{node_id}", user_id=user_id)


async def get_node_versions(
    node_id: int, user_id: int, *, limit: int = 20
) -> list[dict]:
    return await _request(
        "GET",
        f"/nodes/{node_id}/versions",
        user_id=user_id,
        params={"limit": limit},
    )


# ---------------------------------------------------------------------------
# Edges (scoped)
# ---------------------------------------------------------------------------


async def create_edge(
    scope_type: str, scope_id: int, user_id: int, data: dict
) -> dict:
    return await _request(
        "POST",
        f"/scopes/{scope_type}/{scope_id}/edges",
        user_id=user_id,
        json=data,
    )


# ---------------------------------------------------------------------------
# Edges (direct)
# ---------------------------------------------------------------------------


async def get_edge(edge_id: int, user_id: int) -> dict:
    return await _request("GET", f"/edges/{edge_id}", user_id=user_id)


async def delete_edge(edge_id: int, user_id: int) -> None:
    await _request("DELETE", f"/edges/{edge_id}", user_id=user_id)


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------


async def get_graph(
    scope_type: str,
    scope_id: int,
    user_id: int,
    *,
    include_company: bool = False,
    company_id: int | None = None,
) -> dict:
    return await _request(
        "GET",
        f"/scopes/{scope_type}/{scope_id}/graph",
        user_id=user_id,
        params={"include_company": include_company, "company_id": company_id},
    )


async def get_graph_overview(
    scope_type: str, scope_id: int, user_id: int
) -> dict:
    return await _request(
        "GET",
        f"/scopes/{scope_type}/{scope_id}/graph/overview",
        user_id=user_id,
    )


async def search_nodes(
    scope_type: str,
    scope_id: int,
    user_id: int,
    *,
    q: str,
    node_type_def_id: int | None = None,
    limit: int = 10,
) -> list[dict]:
    return await _request(
        "GET",
        f"/scopes/{scope_type}/{scope_id}/search",
        user_id=user_id,
        params={"q": q, "node_type_def_id": node_type_def_id, "limit": limit},
    )


# ---------------------------------------------------------------------------
# Conflicts
# ---------------------------------------------------------------------------


async def list_conflicts(
    scope_type: str, scope_id: int, user_id: int
) -> list[dict]:
    return await _request(
        "GET",
        f"/scopes/{scope_type}/{scope_id}/conflicts",
        user_id=user_id,
    )


async def resolve_conflict(conflict_id: int, user_id: int, data: dict) -> dict:
    return await _request(
        "PATCH",
        f"/conflicts/{conflict_id}",
        user_id=user_id,
        json=data,
    )


# ---------------------------------------------------------------------------
# Public links (scoped)
# ---------------------------------------------------------------------------


async def create_public_link(
    scope_type: str, scope_id: int, user_id: int, data: dict
) -> dict:
    return await _request(
        "POST",
        f"/scopes/{scope_type}/{scope_id}/public-links",
        user_id=user_id,
        json=data,
    )


async def list_public_links(
    scope_type: str, scope_id: int, user_id: int
) -> list[dict]:
    return await _request(
        "GET",
        f"/scopes/{scope_type}/{scope_id}/public-links",
        user_id=user_id,
    )


# ---------------------------------------------------------------------------
# Public links (direct)
# ---------------------------------------------------------------------------


async def update_public_link(link_id: int, user_id: int, data: dict) -> dict:
    return await _request(
        "PATCH",
        f"/public-links/{link_id}",
        user_id=user_id,
        json=data,
    )


async def delete_public_link(link_id: int, user_id: int) -> None:
    await _request("DELETE", f"/public-links/{link_id}", user_id=user_id)


async def add_node_to_link(link_id: int, node_id: int, user_id: int) -> None:
    await _request(
        "POST",
        f"/public-links/{link_id}/nodes",
        user_id=user_id,
        json={"node_id": node_id},
    )


async def remove_node_from_link(
    link_id: int, node_id: int, user_id: int
) -> None:
    await _request(
        "DELETE",
        f"/public-links/{link_id}/nodes/{node_id}",
        user_id=user_id,
    )


# ---------------------------------------------------------------------------
# Types (company-scoped)
# ---------------------------------------------------------------------------


async def list_node_types(company_id: int, user_id: int) -> list[dict]:
    return await _request(
        "GET",
        f"/scopes/company/{company_id}/types/nodes",
        user_id=user_id,
    )


async def create_node_type(company_id: int, user_id: int, data: dict) -> dict:
    return await _request(
        "POST",
        f"/scopes/company/{company_id}/types/nodes",
        user_id=user_id,
        json=data,
    )


async def list_edge_types(company_id: int, user_id: int) -> list[dict]:
    return await _request(
        "GET",
        f"/scopes/company/{company_id}/types/edges",
        user_id=user_id,
    )


async def create_edge_type(company_id: int, user_id: int, data: dict) -> dict:
    return await _request(
        "POST",
        f"/scopes/company/{company_id}/types/edges",
        user_id=user_id,
        json=data,
    )


async def deactivate_node_type(type_id: int, user_id: int) -> dict:
    return await _request(
        "PATCH",
        f"/types/nodes/{type_id}/deactivate",
        user_id=user_id,
    )


async def deactivate_edge_type(type_id: int, user_id: int) -> dict:
    return await _request(
        "PATCH",
        f"/types/edges/{type_id}/deactivate",
        user_id=user_id,
    )


# ---------------------------------------------------------------------------
# Bulk operations
# ---------------------------------------------------------------------------


async def bulk_create_nodes(
    scope_type: str, scope_id: int, user_id: int, nodes: list[dict]
) -> list[dict]:
    return await _request(
        "POST",
        f"/scopes/{scope_type}/{scope_id}/bulk/nodes",
        user_id=user_id,
        json={"nodes": nodes},
    )


async def bulk_create_edges(
    scope_type: str, scope_id: int, user_id: int, edges: list[dict]
) -> list[dict]:
    return await _request(
        "POST",
        f"/scopes/{scope_type}/{scope_id}/bulk/edges",
        user_id=user_id,
        json={"edges": edges},
    )


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------


async def close() -> None:
    """Shut down the connection pool gracefully."""
    global _client  # noqa: PLW0603
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None
