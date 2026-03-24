"""fix RLS policies: use NULLIF to prevent empty string cast to int

Revision ID: 73a49cc035fb
Revises: 0f25c6938fb1
Create Date: 2026-03-21 18:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "73a49cc035fb"
down_revision: str = "0f25c6938fb1"
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
    # --- Drop old broken policies and recreate with NULLIF ---
    for table in _ORG_TABLES:
        op.execute(f"DROP POLICY IF EXISTS org_isolation_{table} ON {table}")
        op.execute(f"""
            CREATE POLICY org_isolation_{table} ON {table}
            USING (
                organization_id = NULLIF(current_setting('app.current_org_id', true), '')::int
                OR NULLIF(current_setting('app.current_org_id', true), '') IS NULL
            )
        """)

    for table in _ORG_NULLABLE_TABLES:
        op.execute(f"DROP POLICY IF EXISTS org_isolation_{table} ON {table}")
        op.execute(f"""
            CREATE POLICY org_isolation_{table} ON {table}
            USING (
                organization_id IS NULL
                OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::int
                OR NULLIF(current_setting('app.current_org_id', true), '') IS NULL
            )
        """)


def downgrade() -> None:
    # --- Restore old policies (without NULLIF) ---
    for table in _ORG_TABLES:
        op.execute(f"DROP POLICY IF EXISTS org_isolation_{table} ON {table}")
        op.execute(f"""
            CREATE POLICY org_isolation_{table} ON {table}
            USING (
                organization_id = current_setting('app.current_org_id', true)::int
                OR current_setting('app.current_org_id', true) IS NULL
                OR current_setting('app.current_org_id', true) = ''
            )
        """)

    for table in _ORG_NULLABLE_TABLES:
        op.execute(f"DROP POLICY IF EXISTS org_isolation_{table} ON {table}")
        op.execute(f"""
            CREATE POLICY org_isolation_{table} ON {table}
            USING (
                organization_id IS NULL
                OR organization_id = current_setting('app.current_org_id', true)::int
                OR current_setting('app.current_org_id', true) IS NULL
                OR current_setting('app.current_org_id', true) = ''
            )
        """)
