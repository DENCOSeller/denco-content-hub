from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

import fakeredis.aioredis
import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.database import get_db
from app.dependencies import get_redis
from app.main import app
from app.models.base import Base
from app.models.company import Company

# Test database: append _test to the main database name
TEST_DATABASE_URL = f"{settings.database_url}_test"


@pytest.fixture(autouse=True)
async def _setup_db() -> AsyncGenerator[None]:
    """Create all tables before each test, drop after."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Seed default company (tests use create_all, not alembic)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        session.add(Company(name="DENCO", slug="denco", is_default=True))
        await session.commit()
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession]:
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest.fixture
async def fake_redis() -> fakeredis.aioredis.FakeRedis:
    redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    yield redis
    await redis.aclose()


@pytest.fixture
async def client(
    db_session: AsyncSession, fake_redis: fakeredis.aioredis.FakeRedis
) -> AsyncGenerator[httpx.AsyncClient]:
    """AsyncClient with overridden DB and Redis dependencies."""

    async def _override_get_db() -> AsyncGenerator[AsyncSession]:
        try:
            yield db_session
        except Exception:
            await db_session.rollback()
            raise

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_redis] = lambda: fake_redis

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helper fixtures
# ---------------------------------------------------------------------------

USER_DATA: dict[str, str] = {
    "email": "test@example.com",
    "password": "StrongPass123",
    "name": "Test User",
}


@pytest.fixture
async def registered_user(client: httpx.AsyncClient) -> dict[str, Any]:
    """Register a user and return {tokens, user_data}."""
    resp = await client.post("/api/v1/auth/register", json=USER_DATA)
    assert resp.status_code == 201
    tokens = resp.json()
    return {"tokens": tokens, **USER_DATA}


@pytest.fixture
async def auth_headers(registered_user: dict[str, Any]) -> dict[str, str]:
    """Authorization header for the registered user."""
    token = registered_user["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}
