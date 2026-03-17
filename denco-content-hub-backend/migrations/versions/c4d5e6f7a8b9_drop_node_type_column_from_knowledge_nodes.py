"""drop node_type column from knowledge_nodes

Revision ID: c4d5e6f7a8b9
Revises: b2c3d4e5f6a7
Create Date: 2026-03-17

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4d5e6f7a8b9"
down_revision: str = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Drop indexes that reference node_type
    op.drop_index("ix_kn_type_company", table_name="knowledge_nodes")
    op.drop_index("ix_kn_type_workspace", table_name="knowledge_nodes")

    # Drop node_type column from knowledge_nodes
    op.drop_column("knowledge_nodes", "node_type")

    # Make node_type nullable in knowledge_node_versions (historical data stays)
    op.alter_column(
        "knowledge_node_versions",
        "node_type",
        existing_type=sa.String(30),
        nullable=True,
    )


def downgrade() -> None:
    # Restore node_type column with default 'note'
    op.add_column(
        "knowledge_nodes",
        sa.Column("node_type", sa.String(30), nullable=False, server_default="note"),
    )

    # Recreate partial indexes
    op.create_index(
        "ix_kn_type_company",
        "knowledge_nodes",
        ["node_type", "company_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_kn_type_workspace",
        "knowledge_nodes",
        ["node_type", "workspace_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # Revert node_type to NOT NULL in knowledge_node_versions
    op.alter_column(
        "knowledge_node_versions",
        "node_type",
        existing_type=sa.String(30),
        nullable=False,
    )
