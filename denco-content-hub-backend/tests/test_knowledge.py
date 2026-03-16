from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import httpx

WS_BASE = "/api/v1/workspaces"

USER_DATA = {
    "email": "test@example.com",
    "password": "StrongPass123",
    "name": "Test User",
}

VIEWER_DATA = {
    "email": "viewer@example.com",
    "password": "StrongPass123",
    "name": "Viewer User",
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


async def create_workspace(client: httpx.AsyncClient, headers: dict[str, str]) -> dict[str, Any]:
    resp = await client.post(WS_BASE, json={"name": "Knowledge WS"}, headers=headers)
    assert resp.status_code == 201
    return resp.json()


def knowledge_url(ws_id: int) -> str:
    return f"{WS_BASE}/{ws_id}/knowledge"


NODE_DATA = {
    "node_type": "target_audience",
    "title": "Test Node",
    "position_x": 100.0,
    "position_y": 200.0,
}


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------


async def test_create_node(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    h = await headers_for(owner)
    ws = await create_workspace(client, h)

    resp = await client.post(f"{knowledge_url(ws['id'])}/nodes", json=NODE_DATA, headers=h)
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Test Node"
    assert body["node_type"] == "target_audience"
    assert body["workspace_id"] == ws["id"]
    assert body["scope_type"] == "workspace"


async def test_create_node_forbidden(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    viewer = await register(client, VIEWER_DATA)
    h_owner = await headers_for(owner)
    h_viewer = await headers_for(viewer)

    ws = await create_workspace(client, h_owner)
    await client.post(
        f"{WS_BASE}/{ws['id']}/members",
        json={"email": VIEWER_DATA["email"], "role": "viewer"},
        headers=h_owner,
    )

    resp = await client.post(f"{knowledge_url(ws['id'])}/nodes", json=NODE_DATA, headers=h_viewer)
    assert resp.status_code == 403


async def test_get_node(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    h = await headers_for(owner)
    ws = await create_workspace(client, h)

    create_resp = await client.post(f"{knowledge_url(ws['id'])}/nodes", json=NODE_DATA, headers=h)
    node_id = create_resp.json()["id"]

    resp = await client.get(f"{knowledge_url(ws['id'])}/nodes/{node_id}", headers=h)
    assert resp.status_code == 200
    assert resp.json()["id"] == node_id
    assert resp.json()["title"] == "Test Node"


async def test_update_node(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    h = await headers_for(owner)
    ws = await create_workspace(client, h)

    create_resp = await client.post(f"{knowledge_url(ws['id'])}/nodes", json=NODE_DATA, headers=h)
    node_id = create_resp.json()["id"]

    resp = await client.patch(
        f"{knowledge_url(ws['id'])}/nodes/{node_id}",
        json={"title": "Updated Title"},
        headers=h,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"


async def test_delete_node(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    h = await headers_for(owner)
    ws = await create_workspace(client, h)

    create_resp = await client.post(f"{knowledge_url(ws['id'])}/nodes", json=NODE_DATA, headers=h)
    node_id = create_resp.json()["id"]

    resp = await client.delete(f"{knowledge_url(ws['id'])}/nodes/{node_id}", headers=h)
    assert resp.status_code == 204

    # Should be gone (soft deleted)
    resp = await client.get(f"{knowledge_url(ws['id'])}/nodes/{node_id}", headers=h)
    assert resp.status_code == 404


async def test_node_versions(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    h = await headers_for(owner)
    ws = await create_workspace(client, h)

    create_resp = await client.post(f"{knowledge_url(ws['id'])}/nodes", json=NODE_DATA, headers=h)
    node_id = create_resp.json()["id"]

    # Update to create a version
    await client.patch(
        f"{knowledge_url(ws['id'])}/nodes/{node_id}",
        json={"title": "V2 Title"},
        headers=h,
    )

    resp = await client.get(f"{knowledge_url(ws['id'])}/nodes/{node_id}/versions", headers=h)
    assert resp.status_code == 200
    versions = resp.json()
    assert len(versions) >= 2  # created + updated
    assert versions[0]["change_type"] in ("created", "updated")


async def test_list_nodes(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    h = await headers_for(owner)
    ws = await create_workspace(client, h)

    await client.post(f"{knowledge_url(ws['id'])}/nodes", json=NODE_DATA, headers=h)
    await client.post(
        f"{knowledge_url(ws['id'])}/nodes",
        json={**NODE_DATA, "title": "Second Node", "node_type": "note"},
        headers=h,
    )

    resp = await client.get(f"{knowledge_url(ws['id'])}/nodes", headers=h)
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # Filter by node_type
    resp = await client.get(f"{knowledge_url(ws['id'])}/nodes?node_type=note", headers=h)
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["node_type"] == "note"


# ---------------------------------------------------------------------------
# Edges
# ---------------------------------------------------------------------------


async def test_create_edge(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    h = await headers_for(owner)
    ws = await create_workspace(client, h)
    url = knowledge_url(ws["id"])

    n1 = (await client.post(f"{url}/nodes", json=NODE_DATA, headers=h)).json()
    n2 = (await client.post(f"{url}/nodes", json={**NODE_DATA, "title": "Node 2"}, headers=h)).json()

    resp = await client.post(
        f"{url}/edges",
        json={"source_node_id": n1["id"], "target_node_id": n2["id"], "label": "relates_to"},
        headers=h,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["source_node_id"] == n1["id"]
    assert body["target_node_id"] == n2["id"]
    assert body["label"] == "relates_to"


async def test_create_edge_duplicate(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    h = await headers_for(owner)
    ws = await create_workspace(client, h)
    url = knowledge_url(ws["id"])

    n1 = (await client.post(f"{url}/nodes", json=NODE_DATA, headers=h)).json()
    n2 = (await client.post(f"{url}/nodes", json={**NODE_DATA, "title": "Node 2"}, headers=h)).json()

    edge_data = {"source_node_id": n1["id"], "target_node_id": n2["id"], "label": "relates_to"}
    await client.post(f"{url}/edges", json=edge_data, headers=h)

    resp = await client.post(f"{url}/edges", json=edge_data, headers=h)
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------


async def test_get_graph(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    h = await headers_for(owner)
    ws = await create_workspace(client, h)
    url = knowledge_url(ws["id"])

    n1 = (await client.post(f"{url}/nodes", json=NODE_DATA, headers=h)).json()
    n2 = (await client.post(f"{url}/nodes", json={**NODE_DATA, "title": "Node 2"}, headers=h)).json()
    await client.post(
        f"{url}/edges",
        json={"source_node_id": n1["id"], "target_node_id": n2["id"], "label": "relates_to"},
        headers=h,
    )

    resp = await client.get(f"{url}/graph", headers=h)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["nodes"]) >= 2
    assert len(body["edges"]) >= 1


# ---------------------------------------------------------------------------
# Positions
# ---------------------------------------------------------------------------


async def test_batch_positions(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    h = await headers_for(owner)
    ws = await create_workspace(client, h)
    url = knowledge_url(ws["id"])

    n1 = (await client.post(f"{url}/nodes", json=NODE_DATA, headers=h)).json()
    n2 = (await client.post(f"{url}/nodes", json={**NODE_DATA, "title": "Node 2"}, headers=h)).json()

    resp = await client.patch(
        f"{url}/nodes/positions",
        json={
            "positions": [
                {"node_id": n1["id"], "position_x": 50.0, "position_y": 60.0},
                {"node_id": n2["id"], "position_x": 150.0, "position_y": 160.0},
            ]
        },
        headers=h,
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] == 2

    # Verify positions updated
    node = (await client.get(f"{url}/nodes/{n1['id']}", headers=h)).json()
    assert node["position_x"] == 50.0
    assert node["position_y"] == 60.0
