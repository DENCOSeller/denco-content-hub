"""add kg_conflicts table

Revision ID: a1b2c3d4e5f6
Revises: f6a7b8c9d1e2
Create Date: 2026-03-17

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "f6a7b8c9d1e2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "kg_conflicts",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "company_node_id",
            sa.Integer,
            sa.ForeignKey("knowledge_nodes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "workspace_node_id",
            sa.Integer,
            sa.ForeignKey("knowledge_nodes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "conflict_type",
            sa.String(30),
            nullable=False,
        ),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="open",
        ),
        sa.Column(
            "resolved_by_user_id",
            sa.Integer,
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "resolved_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # CHECK constraints
    op.create_check_constraint(
        "ck_kg_conflicts_conflict_type",
        "kg_conflicts",
        "conflict_type IN ('title_clash', 'semantic_overlap', 'contradiction')",
    )
    op.create_check_constraint(
        "ck_kg_conflicts_status",
        "kg_conflicts",
        "status IN ('open', 'resolved', 'dismissed')",
    )

    # Indexes
    op.create_index(
        "ix_kgc_status",
        "kg_conflicts",
        ["status"],
        postgresql_where=sa.text("status = 'open'"),
    )
    op.create_index(
        "ix_kgc_workspace",
        "kg_conflicts",
        ["workspace_node_id"],
    )
    op.create_index(
        "ix_kgc_company",
        "kg_conflicts",
        ["company_node_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_kgc_company", table_name="kg_conflicts")
    op.drop_index("ix_kgc_workspace", table_name="kg_conflicts")
    op.drop_index("ix_kgc_status", table_name="kg_conflicts")
    op.drop_constraint("ck_kg_conflicts_status", "kg_conflicts", type_="check")
    op.drop_constraint("ck_kg_conflicts_conflict_type", "kg_conflicts", type_="check")
    op.drop_table("kg_conflicts")
