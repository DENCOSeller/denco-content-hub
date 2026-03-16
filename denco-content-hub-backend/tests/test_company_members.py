from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import select

from app.models.company import Company
from app.models.company_member import CompanyMember, CompanyRole

if TYPE_CHECKING:
    import httpx
    from sqlalchemy.ext.asyncio import AsyncSession

USER_DATA = {
    "email": "owner@example.com",
    "password": "StrongPass123",
    "name": "Owner User",
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


async def get_user_id(client: httpx.AsyncClient, headers: dict[str, str]) -> int:
    resp = await client.get("/api/v1/users/me", headers=headers)
    assert resp.status_code == 200
    return resp.json()["id"]


async def get_default_company_id(db: AsyncSession) -> int:
    result = await db.execute(select(Company).where(Company.is_default.is_(True)))
    return result.scalar_one().id


async def make_company_owner(db: AsyncSession, company_id: int, user_id: int) -> None:
    """Directly insert company owner membership for testing."""
    db.add(CompanyMember(company_id=company_id, user_id=user_id, role=CompanyRole.OWNER))
    await db.commit()


def members_url(company_id: int) -> str:
    return f"/api/v1/companies/{company_id}/members"


# ---------------------------------------------------------------------------
# Add member
# ---------------------------------------------------------------------------


async def test_add_company_member(client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    owner = await register(client, USER_DATA)
    second = await register(client, SECOND_USER)
    h_owner = await headers_for(owner)
    h_second = await headers_for(second)

    company_id = await get_default_company_id(db_session)
    owner_user_id = await get_user_id(client, h_owner)
    second_user_id = await get_user_id(client, h_second)
    await make_company_owner(db_session, company_id, owner_user_id)

    resp = await client.post(
        members_url(company_id),
        json={"user_id": second_user_id, "role": "member"},
        headers=h_owner,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["user_id"] == second_user_id
    assert body["role"] == "member"
    assert body["user_email"] == SECOND_USER["email"]


async def test_add_duplicate_member(client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    owner = await register(client, USER_DATA)
    second = await register(client, SECOND_USER)
    h_owner = await headers_for(owner)
    h_second = await headers_for(second)

    company_id = await get_default_company_id(db_session)
    owner_user_id = await get_user_id(client, h_owner)
    second_user_id = await get_user_id(client, h_second)
    await make_company_owner(db_session, company_id, owner_user_id)

    await client.post(
        members_url(company_id),
        json={"user_id": second_user_id, "role": "member"},
        headers=h_owner,
    )
    resp = await client.post(
        members_url(company_id),
        json={"user_id": second_user_id, "role": "admin"},
        headers=h_owner,
    )
    assert resp.status_code == 409
    assert "already" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Update role
# ---------------------------------------------------------------------------


async def test_update_member_role(client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    owner = await register(client, USER_DATA)
    second = await register(client, SECOND_USER)
    h_owner = await headers_for(owner)
    h_second = await headers_for(second)

    company_id = await get_default_company_id(db_session)
    owner_user_id = await get_user_id(client, h_owner)
    second_user_id = await get_user_id(client, h_second)
    await make_company_owner(db_session, company_id, owner_user_id)

    add_resp = await client.post(
        members_url(company_id),
        json={"user_id": second_user_id, "role": "member"},
        headers=h_owner,
    )
    member_id = add_resp.json()["id"]

    resp = await client.patch(
        f"{members_url(company_id)}/{member_id}",
        json={"role": "admin"},
        headers=h_owner,
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "admin"


# ---------------------------------------------------------------------------
# Remove member
# ---------------------------------------------------------------------------


async def test_remove_member(client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    owner = await register(client, USER_DATA)
    second = await register(client, SECOND_USER)
    h_owner = await headers_for(owner)
    h_second = await headers_for(second)

    company_id = await get_default_company_id(db_session)
    owner_user_id = await get_user_id(client, h_owner)
    second_user_id = await get_user_id(client, h_second)
    await make_company_owner(db_session, company_id, owner_user_id)

    add_resp = await client.post(
        members_url(company_id),
        json={"user_id": second_user_id, "role": "member"},
        headers=h_owner,
    )
    member_id = add_resp.json()["id"]

    resp = await client.delete(f"{members_url(company_id)}/{member_id}", headers=h_owner)
    assert resp.status_code == 204


async def test_cannot_remove_owner(client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    owner = await register(client, USER_DATA)
    h_owner = await headers_for(owner)

    company_id = await get_default_company_id(db_session)
    owner_user_id = await get_user_id(client, h_owner)
    await make_company_owner(db_session, company_id, owner_user_id)

    # Find the owner's member id
    result = await db_session.execute(
        select(CompanyMember).where(
            CompanyMember.company_id == company_id,
            CompanyMember.user_id == owner_user_id,
        )
    )
    owner_member = result.scalar_one()

    resp = await client.delete(f"{members_url(company_id)}/{owner_member.id}", headers=h_owner)
    assert resp.status_code == 403
    assert "owner" in resp.json()["detail"].lower()
