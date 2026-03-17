"""add provenance fields to knowledge_nodes

Revision ID: c3a8e5f14b72
Revises: b1f3a7c9d201
Create Date: 2026-03-17 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3a8e5f14b72"
down_revision: str | None = "b1f3a7c9d201"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- Add provenance columns to knowledge_nodes ---
    op.add_column(
        "knowledge_nodes",
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="active",
        ),
    )
    op.create_check_constraint(
        "ck_knowledge_nodes_status",
        "knowledge_nodes",
        "status IN ('active', 'draft', 'deprecated')",
    )

    op.add_column(
        "knowledge_nodes",
        sa.Column("owner_role", sa.String(length=100), nullable=True),
    )

    op.add_column(
        "knowledge_nodes",
        sa.Column("source", sa.String(length=255), nullable=True),
    )

    op.add_column(
        "knowledge_nodes",
        sa.Column(
            "confidence",
            sa.String(length=10),
            nullable=True,
            server_default="medium",
        ),
    )
    op.create_check_constraint(
        "ck_knowledge_nodes_confidence",
        "knowledge_nodes",
        "confidence IN ('low', 'medium', 'high')",
    )

    op.add_column(
        "knowledge_nodes",
        sa.Column("last_reviewed", sa.DateTime(timezone=True), nullable=True),
    )

    op.add_column(
        "knowledge_nodes",
        sa.Column("superseded_by_node_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_kn_superseded_by",
        "knowledge_nodes",
        "knowledge_nodes",
        ["superseded_by_node_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- Partial indexes ---
    op.create_index(
        "ix_kn_status",
        "knowledge_nodes",
        ["status"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_kn_review",
        "knowledge_nodes",
        ["last_reviewed"],
        postgresql_where=sa.text("deleted_at IS NULL AND status = 'active'"),
    )


def downgrade() -> None:
    op.drop_index("ix_kn_review", table_name="knowledge_nodes")
    op.drop_index("ix_kn_status", table_name="knowledge_nodes")
    op.drop_constraint("fk_kn_superseded_by", "knowledge_nodes", type_="foreignkey")
    op.drop_constraint("ck_knowledge_nodes_confidence", "knowledge_nodes", type_="check")
    op.drop_constraint("ck_knowledge_nodes_status", "knowledge_nodes", type_="check")
    op.drop_column("knowledge_nodes", "superseded_by_node_id")
    op.drop_column("knowledge_nodes", "last_reviewed")
    op.drop_column("knowledge_nodes", "confidence")
    op.drop_column("knowledge_nodes", "source")
    op.drop_column("knowledge_nodes", "owner_role")
    op.drop_column("knowledge_nodes", "status")
