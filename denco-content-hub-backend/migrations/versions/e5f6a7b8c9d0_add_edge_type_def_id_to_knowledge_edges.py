"""add edge_type_def_id to knowledge_edges

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-17

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: str | None = "d4e5f6a7b8c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Добавить колонку edge_type_def_id (nullable=True)
    op.add_column(
        "knowledge_edges",
        sa.Column(
            "edge_type_def_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    # 2. Data migration: заполнить edge_type_def_id на основе label → slug
    # Сначала попытка прямого маппинга label → slug
    op.execute(
        """
        UPDATE knowledge_edges
        SET edge_type_def_id = kg_edge_type_defs.id
        FROM kg_edge_type_defs
        WHERE kg_edge_type_defs.slug = knowledge_edges.label
        """
    )

    # Для оставшихся (label не совпадает со slug) — дефолт "related_to"
    op.execute(
        """
        UPDATE knowledge_edges
        SET edge_type_def_id = (
            SELECT id FROM kg_edge_type_defs WHERE slug = 'related_to'
        )
        WHERE edge_type_def_id IS NULL
        """
    )

    # 3. Добавить FK constraint
    op.create_foreign_key(
        "fk_knowledge_edges_edge_type_def_id",
        "knowledge_edges",
        "kg_edge_type_defs",
        ["edge_type_def_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 4. Создать index
    op.create_index(
        "ix_knowledge_edges_edge_type_def_id",
        "knowledge_edges",
        ["edge_type_def_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_knowledge_edges_edge_type_def_id",
        table_name="knowledge_edges",
    )
    op.drop_constraint(
        "fk_knowledge_edges_edge_type_def_id",
        "knowledge_edges",
        type_="foreignkey",
    )
    op.drop_column("knowledge_edges", "edge_type_def_id")
