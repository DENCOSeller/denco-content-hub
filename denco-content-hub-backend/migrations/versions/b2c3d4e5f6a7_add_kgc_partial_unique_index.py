"""add partial unique index uq_kgc_pair_type_open and partial ix_kgc_status

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-17

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: str = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Пересоздаём ix_kgc_status как partial index (только open)
    op.drop_index("ix_kgc_status", table_name="kg_conflicts")
    op.execute("CREATE INDEX ix_kgc_status ON kg_conflicts (status) WHERE status = 'open'")

    # Partial unique index для защиты от дублей
    op.execute(
        "CREATE UNIQUE INDEX uq_kgc_pair_type_open "
        "ON kg_conflicts (company_node_id, workspace_node_id, conflict_type) "
        "WHERE status = 'open'"
    )


def downgrade() -> None:
    op.drop_index("uq_kgc_pair_type_open", table_name="kg_conflicts")
    op.drop_index("ix_kgc_status", table_name="kg_conflicts")
    op.create_index("ix_kgc_status", "kg_conflicts", ["status"])
