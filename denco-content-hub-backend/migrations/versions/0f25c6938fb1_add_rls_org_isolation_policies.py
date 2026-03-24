"""add RLS org isolation policies

Revision ID: 0f25c6938fb1
Revises: fca9e7d7aeaf
Create Date: 2026-03-21 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0f25c6938fb1"
down_revision: tuple[str, ...] = ("fca9e7d7aeaf", "bde79cde410d")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Tables with organization_id column (strict isolation)
_ORG_TABLES = [
    "workspaces",
    "organization_members",
    "teams",
    "knowledge_nodes",
]

# Tables where organization_id can be NULL (system/shared records visible to all)
_ORG_NULLABLE_TABLES = [
    "kg_node_type_defs",
    "kg_edge_type_defs",
]


def upgrade() -> None:
    # --- Enable RLS + FORCE (owner bypass protection) ---
    for table in _ORG_TABLES + _ORG_NULLABLE_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

    # --- Policies for strict org isolation ---
    # Logic: allow access if:
    #   1. row's organization_id matches current_setting('app.current_org_id')
    #   2. OR current_setting is NULL/empty (no org context = bypass for cron/migrations)
    for table in _ORG_TABLES:
        op.execute(f"""
            CREATE POLICY org_isolation_{table} ON {table}
            USING (
                organization_id = current_setting('app.current_org_id', true)::int
                OR current_setting('app.current_org_id', true) IS NULL
                OR current_setting('app.current_org_id', true) = ''
            )
        """)

    # --- Policies for tables with nullable organization_id ---
    # Same as above, but also allow rows where organization_id IS NULL (system records)
    for table in _ORG_NULLABLE_TABLES:
        op.execute(f"""
            CREATE POLICY org_isolation_{table} ON {table}
            USING (
                organization_id IS NULL
                OR organization_id = current_setting('app.current_org_id', true)::int
                OR current_setting('app.current_org_id', true) IS NULL
                OR current_setting('app.current_org_id', true) = ''
            )
        """)


def downgrade() -> None:
    for table in _ORG_TABLES + _ORG_NULLABLE_TABLES:
        op.execute(f"DROP POLICY IF EXISTS org_isolation_{table} ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
