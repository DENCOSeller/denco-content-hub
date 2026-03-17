"""add node_type_def_id to knowledge_nodes

Revision ID: d4e5f6a7b8c9
Revises: c3a8e5f14b72
Create Date: 2026-03-17

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3a8e5f14b72"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Добавить колонку node_type_def_id (nullable=True)
    op.add_column(
        "knowledge_nodes",
        sa.Column(
            "node_type_def_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    # 2. Data migration: заполнить node_type_def_id на основе slug
    op.execute(
        """
        UPDATE knowledge_nodes
        SET node_type_def_id = kg_node_type_defs.id
        FROM kg_node_type_defs
        WHERE kg_node_type_defs.slug = knowledge_nodes.node_type
        """
    )

    # 3. Добавить FK constraint
    op.create_foreign_key(
        "fk_knowledge_nodes_node_type_def_id",
        "knowledge_nodes",
        "kg_node_type_defs",
        ["node_type_def_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 4. Создать index
    op.create_index(
        "ix_knowledge_nodes_node_type_def_id",
        "knowledge_nodes",
        ["node_type_def_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_knowledge_nodes_node_type_def_id",
        table_name="knowledge_nodes",
    )
    op.drop_constraint(
        "fk_knowledge_nodes_node_type_def_id",
        "knowledge_nodes",
        type_="foreignkey",
    )
    op.drop_column("knowledge_nodes", "node_type_def_id")
