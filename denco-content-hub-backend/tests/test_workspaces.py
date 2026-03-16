from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import httpx

BASE = "/api/v1/workspaces"

USER_DATA = {
    "email": "test@example.com",
    "password": "StrongPass123",
    "name": "Test User",
}

SECOND_USER = {
    "email": "second@example.com",
    "password": "StrongPass123",
    "name": "Second User",
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


async def create_workspace(
    client: httpx.AsyncClient, headers: dict[str, str], name: str = "My Workspace"
) -> dict[str, Any]:
    resp = await client.post(BASE, json={"name": name}, headers=headers)
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# List workspaces
# ---------------------------------------------------------------------------


async def test_list_workspaces_has_personal(client: httpx.AsyncClient, auth_headers: dict[str, str]) -> None:
    """After registration user has a personal workspace."""
    resp = await client.get(BASE, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) >= 1
    personal = [w for w in body if w["is_personal"]]
    assert len(personal) == 1
    assert personal[0]["role"] == "owner"


async def test_list_workspaces_unauthenticated(client: httpx.AsyncClient) -> None:
    resp = await client.get(BASE)
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Create workspace
# ---------------------------------------------------------------------------


async def test_create_workspace(client: httpx.AsyncClient, auth_headers: dict[str, str]) -> None:
    ws = await create_workspace(client, auth_headers, "New Project")
    assert ws["name"] == "New Project"
    assert ws["is_personal"] is False
    assert ws["role"] == "owner"
    assert "slug" in ws
    assert "id" in ws


async def test_create_workspace_slug_generated(client: httpx.AsyncClient, auth_headers: dict[str, str]) -> None:
    ws = await create_workspace(client, auth_headers, "Hello World!")
    assert "hello-world" in ws["slug"]


async def test_create_workspace_unauthenticated(client: httpx.AsyncClient) -> None:
    resp = await client.post(BASE, json={"name": "No Auth"})
    assert resp.status_code == 403


async def test_create_workspace_empty_name(client: httpx.AsyncClient, auth_headers: dict[str, str]) -> None:
    resp = await client.post(BASE, json={"name": ""}, headers=auth_headers)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Get workspace detail
# ---------------------------------------------------------------------------


async def test_get_workspace(client: httpx.AsyncClient, auth_headers: dict[str, str]) -> None:
    ws = await create_workspace(client, auth_headers)
    resp = await client.get(f"{BASE}/{ws['id']}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == ws["id"]
    assert resp.json()["role"] == "owner"


async def test_get_workspace_not_member(client: httpx.AsyncClient) -> None:
    user1 = await register(client, USER_DATA)
    user2 = await register(client, SECOND_USER)
    h1 = await headers_for(user1)
    h2 = await headers_for(user2)

    ws = await create_workspace(client, h1)
    resp = await client.get(f"{BASE}/{ws['id']}", headers=h2)
    assert resp.status_code == 404


async def test_get_workspace_nonexistent(client: httpx.AsyncClient, auth_headers: dict[str, str]) -> None:
    resp = await client.get(f"{BASE}/99999", headers=auth_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Update workspace
# ---------------------------------------------------------------------------


async def test_update_workspace_name(client: httpx.AsyncClient, auth_headers: dict[str, str]) -> None:
    ws = await create_workspace(client, auth_headers)
    resp = await client.patch(f"{BASE}/{ws['id']}", json={"name": "Renamed"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"
    assert "renamed" in resp.json()["slug"]


async def test_update_workspace_forbidden_for_viewer(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    viewer = await register(client, SECOND_USER)
    h_owner = await headers_for(owner)
    h_viewer = await headers_for(viewer)

    ws = await create_workspace(client, h_owner)

    # Add second user as viewer
    await client.post(
        f"{BASE}/{ws['id']}/members",
        json={"email": SECOND_USER["email"], "role": "viewer"},
        headers=h_owner,
    )

    resp = await client.patch(f"{BASE}/{ws['id']}", json={"name": "Hacked"}, headers=h_viewer)
    assert resp.status_code == 403


async def test_update_workspace_admin_allowed(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    admin = await register(client, SECOND_USER)
    h_owner = await headers_for(owner)
    h_admin = await headers_for(admin)

    ws = await create_workspace(client, h_owner)
    await client.post(
        f"{BASE}/{ws['id']}/members",
        json={"email": SECOND_USER["email"], "role": "admin"},
        headers=h_owner,
    )

    resp = await client.patch(f"{BASE}/{ws['id']}", json={"name": "Admin Edit"}, headers=h_admin)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Admin Edit"


# ---------------------------------------------------------------------------
# Delete workspace
# ---------------------------------------------------------------------------


async def test_delete_workspace(client: httpx.AsyncClient, auth_headers: dict[str, str]) -> None:
    ws = await create_workspace(client, auth_headers)
    resp = await client.delete(f"{BASE}/{ws['id']}", headers=auth_headers)
    assert resp.status_code == 204

    # Should be gone
    resp = await client.get(f"{BASE}/{ws['id']}", headers=auth_headers)
    assert resp.status_code == 404


async def test_delete_personal_workspace_forbidden(client: httpx.AsyncClient, auth_headers: dict[str, str]) -> None:
    resp = await client.get(BASE, headers=auth_headers)
    personal = next(w for w in resp.json() if w["is_personal"])

    resp = await client.delete(f"{BASE}/{personal['id']}", headers=auth_headers)
    assert resp.status_code == 403
    assert "personal" in resp.json()["detail"].lower()


async def test_delete_workspace_not_owner(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    admin = await register(client, SECOND_USER)
    h_owner = await headers_for(owner)
    h_admin = await headers_for(admin)

    ws = await create_workspace(client, h_owner)
    await client.post(
        f"{BASE}/{ws['id']}/members",
        json={"email": SECOND_USER["email"], "role": "admin"},
        headers=h_owner,
    )

    resp = await client.delete(f"{BASE}/{ws['id']}", headers=h_admin)
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# List members
# ---------------------------------------------------------------------------


async def test_list_members(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    await register(client, SECOND_USER)
    h_owner = await headers_for(owner)

    ws = await create_workspace(client, h_owner)
    await client.post(
        f"{BASE}/{ws['id']}/members",
        json={"email": SECOND_USER["email"], "role": "editor"},
        headers=h_owner,
    )

    resp = await client.get(f"{BASE}/{ws['id']}/members", headers=h_owner)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert body["page"] == 1
    assert len(body["items"]) == 2


async def test_list_members_pagination(client: httpx.AsyncClient, auth_headers: dict[str, str]) -> None:
    ws = await create_workspace(client, auth_headers)
    resp = await client.get(f"{BASE}/{ws['id']}/members?page=1&size=1", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["size"] == 1
    assert len(body["items"]) == 1
    assert body["total"] == 1


async def test_list_members_not_member(client: httpx.AsyncClient) -> None:
    user1 = await register(client, USER_DATA)
    user2 = await register(client, SECOND_USER)
    h1 = await headers_for(user1)
    h2 = await headers_for(user2)

    ws = await create_workspace(client, h1)
    resp = await client.get(f"{BASE}/{ws['id']}/members", headers=h2)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Add member
# ---------------------------------------------------------------------------


async def test_add_member(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    await register(client, SECOND_USER)
    h_owner = await headers_for(owner)

    ws = await create_workspace(client, h_owner)
    resp = await client.post(
        f"{BASE}/{ws['id']}/members",
        json={"email": SECOND_USER["email"], "role": "editor"},
        headers=h_owner,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["user_email"] == SECOND_USER["email"]
    assert body["role"] == "editor"


async def test_add_member_duplicate(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    await register(client, SECOND_USER)
    h_owner = await headers_for(owner)

    ws = await create_workspace(client, h_owner)
    await client.post(
        f"{BASE}/{ws['id']}/members",
        json={"email": SECOND_USER["email"], "role": "editor"},
        headers=h_owner,
    )
    resp = await client.post(
        f"{BASE}/{ws['id']}/members",
        json={"email": SECOND_USER["email"], "role": "viewer"},
        headers=h_owner,
    )
    assert resp.status_code == 409
    assert "already" in resp.json()["detail"].lower()


async def test_add_member_nonexistent_user(client: httpx.AsyncClient, auth_headers: dict[str, str]) -> None:
    ws = await create_workspace(client, auth_headers)
    resp = await client.post(
        f"{BASE}/{ws['id']}/members",
        json={"email": "ghost@example.com", "role": "editor"},
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert "user not found" in resp.json()["detail"].lower()


async def test_add_member_viewer_forbidden(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    viewer = await register(client, SECOND_USER)
    h_owner = await headers_for(owner)
    h_viewer = await headers_for(viewer)

    ws = await create_workspace(client, h_owner)
    await client.post(
        f"{BASE}/{ws['id']}/members",
        json={"email": SECOND_USER["email"], "role": "viewer"},
        headers=h_owner,
    )

    third = {"email": "third@example.com", "password": "StrongPass123", "name": "Third"}
    await register(client, third)

    resp = await client.post(
        f"{BASE}/{ws['id']}/members",
        json={"email": third["email"], "role": "editor"},
        headers=h_viewer,
    )
    assert resp.status_code == 403


async def test_add_member_owner_role_rejected(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    await register(client, SECOND_USER)
    h_owner = await headers_for(owner)

    ws = await create_workspace(client, h_owner)
    resp = await client.post(
        f"{BASE}/{ws['id']}/members",
        json={"email": SECOND_USER["email"], "role": "owner"},
        headers=h_owner,
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Update member role
# ---------------------------------------------------------------------------


async def test_update_member_role(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    await register(client, SECOND_USER)
    h_owner = await headers_for(owner)

    ws = await create_workspace(client, h_owner)
    add_resp = await client.post(
        f"{BASE}/{ws['id']}/members",
        json={"email": SECOND_USER["email"], "role": "editor"},
        headers=h_owner,
    )
    member_id = add_resp.json()["id"]

    resp = await client.patch(
        f"{BASE}/{ws['id']}/members/{member_id}",
        json={"role": "viewer"},
        headers=h_owner,
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "viewer"


async def test_update_owner_role_forbidden(client: httpx.AsyncClient) -> None:
    """Cannot change the owner's role."""
    owner = await register(client, USER_DATA)
    await register(client, SECOND_USER)
    h_owner = await headers_for(owner)

    ws = await create_workspace(client, h_owner)
    # Get owner member id from members list
    members_resp = await client.get(f"{BASE}/{ws['id']}/members", headers=h_owner)
    owner_member = next(m for m in members_resp.json()["items"] if m["role"] == "owner")

    resp = await client.patch(
        f"{BASE}/{ws['id']}/members/{owner_member['id']}",
        json={"role": "admin"},
        headers=h_owner,
    )
    assert resp.status_code == 403
    assert "owner" in resp.json()["detail"].lower()


async def test_admin_cannot_assign_admin(client: httpx.AsyncClient) -> None:
    """Only owner can assign admin role."""
    owner = await register(client, USER_DATA)
    admin = await register(client, SECOND_USER)
    h_owner = await headers_for(owner)
    h_admin = await headers_for(admin)

    ws = await create_workspace(client, h_owner)
    await client.post(
        f"{BASE}/{ws['id']}/members",
        json={"email": SECOND_USER["email"], "role": "admin"},
        headers=h_owner,
    )

    third = {"email": "third@example.com", "password": "StrongPass123", "name": "Third"}
    await register(client, third)
    add_resp = await client.post(
        f"{BASE}/{ws['id']}/members",
        json={"email": third["email"], "role": "editor"},
        headers=h_owner,
    )
    member_id = add_resp.json()["id"]

    resp = await client.patch(
        f"{BASE}/{ws['id']}/members/{member_id}",
        json={"role": "admin"},
        headers=h_admin,
    )
    assert resp.status_code == 403
    assert "only owner" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Remove member
# ---------------------------------------------------------------------------


async def test_remove_member(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    await register(client, SECOND_USER)
    h_owner = await headers_for(owner)

    ws = await create_workspace(client, h_owner)
    add_resp = await client.post(
        f"{BASE}/{ws['id']}/members",
        json={"email": SECOND_USER["email"], "role": "editor"},
        headers=h_owner,
    )
    member_id = add_resp.json()["id"]

    resp = await client.delete(f"{BASE}/{ws['id']}/members/{member_id}", headers=h_owner)
    assert resp.status_code == 204

    # Verify member removed — list should have only owner
    members = await client.get(f"{BASE}/{ws['id']}/members", headers=h_owner)
    assert members.json()["total"] == 1


async def test_remove_owner_forbidden(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    h_owner = await headers_for(owner)

    ws = await create_workspace(client, h_owner)
    members_resp = await client.get(f"{BASE}/{ws['id']}/members", headers=h_owner)
    owner_member = members_resp.json()["items"][0]

    resp = await client.delete(f"{BASE}/{ws['id']}/members/{owner_member['id']}", headers=h_owner)
    assert resp.status_code == 403
    assert "owner" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Leave workspace
# ---------------------------------------------------------------------------


async def test_leave_workspace(client: httpx.AsyncClient) -> None:
    owner = await register(client, USER_DATA)
    member = await register(client, SECOND_USER)
    h_owner = await headers_for(owner)
    h_member = await headers_for(member)

    ws = await create_workspace(client, h_owner)
    await client.post(
        f"{BASE}/{ws['id']}/members",
        json={"email": SECOND_USER["email"], "role": "editor"},
        headers=h_owner,
    )

    resp = await client.post(f"{BASE}/{ws['id']}/members/leave", headers=h_member)
    assert resp.status_code == 204

    # Verify: member can no longer access workspace
    resp = await client.get(f"{BASE}/{ws['id']}", headers=h_member)
    assert resp.status_code == 404


async def test_owner_cannot_leave(client: httpx.AsyncClient, auth_headers: dict[str, str]) -> None:
    ws = await create_workspace(client, auth_headers)
    resp = await client.post(f"{BASE}/{ws['id']}/members/leave", headers=auth_headers)
    assert resp.status_code == 403
    assert "owner" in resp.json()["detail"].lower()


async def test_leave_workspace_not_member(client: httpx.AsyncClient) -> None:
    user1 = await register(client, USER_DATA)
    user2 = await register(client, SECOND_USER)
    h1 = await headers_for(user1)
    h2 = await headers_for(user2)

    ws = await create_workspace(client, h1)
    resp = await client.post(f"{BASE}/{ws['id']}/members/leave", headers=h2)
    assert resp.status_code == 404
