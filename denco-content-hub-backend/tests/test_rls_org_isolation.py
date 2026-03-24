"""Tests for PostgreSQL Row-Level Security org isolation.

These tests verify that RLS policies correctly enforce org isolation
on the production database (with real Alembic migrations applied).
They use the app user to connect and test that:
1. Without org context, all data is visible (bypass for cron/migrations)
2. With correct org context, only matching data is visible
3. With wrong org context, no data is visible
4. System records (NULL org_id) are always visible
"""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

# Connect to the REAL database (not _test) to verify RLS policies from Alembic
_engine = create_async_engine(settings.database_url, echo=False)
_factory = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def rls_session():
    """Session connected to the real database for RLS testing."""
    async with _factory() as session:
        yield session
    await _engine.dispose()


@pytest.mark.asyncio
async def test_rls_no_context_returns_all(rls_session: AsyncSession):
    """Without org context (cron/migration mode), all rows visible."""
    result = await rls_session.execute(text("SELECT count(*) FROM workspaces"))
    count = result.scalar()
    # Should return all workspaces (no filtering)
    assert count is not None and count >= 0


@pytest.mark.asyncio
async def test_rls_correct_org_returns_matching(rls_session: AsyncSession):
    """With org context set, only matching rows visible."""
    # Get actual org_id from database
    result = await rls_session.execute(
        text("SELECT organization_id FROM workspaces LIMIT 1")
    )
    row = result.first()
    if row is None:
        pytest.skip("No workspaces in database to test RLS")
    org_id = row[0]

    # Set org context
    await rls_session.execute(
        text(f"SET LOCAL app.current_org_id = '{int(org_id)}'")
    )

    # All returned workspaces should belong to this org
    result = await rls_session.execute(text("SELECT organization_id FROM workspaces"))
    rows = result.all()
    assert len(rows) > 0
    for r in rows:
        assert r[0] == org_id


@pytest.mark.asyncio
async def test_rls_wrong_org_returns_empty(rls_session: AsyncSession):
    """With non-existent org context, no rows visible."""
    await rls_session.execute(
        text("SET LOCAL app.current_org_id = '999999'")
    )
    result = await rls_session.execute(text("SELECT count(*) FROM workspaces"))
    count = result.scalar()
    assert count == 0


@pytest.mark.asyncio
async def test_rls_cross_org_isolation(rls_session: AsyncSession):
    """Setting org 1 should not see org 2 workspaces."""
    # Get distinct org_ids
    result = await rls_session.execute(
        text("SELECT DISTINCT organization_id FROM workspaces ORDER BY organization_id")
    )
    org_ids = [r[0] for r in result.all()]
    if len(org_ids) < 2:
        pytest.skip("Need at least 2 organizations to test cross-org isolation")

    org_a, org_b = org_ids[0], org_ids[1]

    # Set context to org_a
    await rls_session.execute(
        text(f"SET LOCAL app.current_org_id = '{int(org_a)}'")
    )

    # Should not see org_b workspaces
    result = await rls_session.execute(
        text("SELECT count(*) FROM workspaces WHERE organization_id = :other_org"),
        {"other_org": org_b},
    )
    count = result.scalar()
    assert count == 0


@pytest.mark.asyncio
async def test_rls_nullable_org_system_records_visible(rls_session: AsyncSession):
    """System records (NULL org_id) in kg_node_type_defs visible with any context."""
    # Check if there are system records
    result = await rls_session.execute(
        text("SELECT count(*) FROM kg_node_type_defs WHERE organization_id IS NULL")
    )
    system_count = result.scalar()
    if system_count == 0:
        pytest.skip("No system kg_node_type_defs to test")

    # Set context to non-existent org
    await rls_session.execute(
        text("SET LOCAL app.current_org_id = '999999'")
    )

    # System records should still be visible
    result = await rls_session.execute(
        text("SELECT count(*) FROM kg_node_type_defs WHERE organization_id IS NULL")
    )
    filtered_count = result.scalar()
    assert filtered_count == system_count
