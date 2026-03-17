"""add provenance fields to knowledge_node_versions

Revision ID: f6a7b8c9d1e2
Revises: e5f6a7b8c9d0
Create Date: 2026-03-17

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d1e2"
down_revision: str | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- status ---
    op.add_column(
        "knowledge_node_versions",
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=True,
            server_default="active",
        ),
    )
    op.create_check_constraint(
        "ck_knowledge_node_versions_status",
        "knowledge_node_versions",
        "status IN ('active', 'draft', 'deprecated')",
    )

    # --- confidence ---
    op.add_column(
        "knowledge_node_versions",
        sa.Column(
            "confidence",
            sa.String(length=10),
            nullable=True,
        ),
    )
    op.create_check_constraint(
        "ck_knowledge_node_versions_confidence",
        "knowledge_node_versions",
        "confidence IN ('low', 'medium', 'high')",
    )

    # --- Backfill existing rows: status from parent node, confidence stays NULL ---
    op.execute(
        """
        UPDATE knowledge_node_versions
        SET status = COALESCE(kn.status, 'active')
        FROM knowledge_nodes kn
        WHERE knowledge_node_versions.node_id = kn.id
          AND knowledge_node_versions.status IS NULL
        """
    )

    # Для версий без связанного node — ставим дефолт
    op.execute(
        """
        UPDATE knowledge_node_versions
        SET status = 'active'
        WHERE status IS NULL
        """
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_knowledge_node_versions_confidence",
        "knowledge_node_versions",
        type_="check",
    )
    op.drop_constraint(
        "ck_knowledge_node_versions_status",
        "knowledge_node_versions",
        type_="check",
    )
    op.drop_column("knowledge_node_versions", "confidence")
    op.drop_column("knowledge_node_versions", "status")
