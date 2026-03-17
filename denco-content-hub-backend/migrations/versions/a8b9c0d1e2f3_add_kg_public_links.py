"""add kg_public_links and kg_public_link_nodes tables

Revision ID: a8b9c0d1e2f3
Revises: c4d5e6f7a8b9
Create Date: 2026-03-17

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a8b9c0d1e2f3"
down_revision: str | None = "c4d5e6f7a8b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- kg_public_links ---
    op.create_table(
        "kg_public_links",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "token",
            postgresql.UUID(as_uuid=False),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("scope_type", sa.String(length=20), nullable=False),
        sa.Column("scope_id", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "visibility_mode",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'active'"),
        ),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token", name="uq_kg_public_links_token"),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.CheckConstraint(
            "scope_type IN ('company', 'workspace')",
            name="ck_kg_public_links_scope_type",
        ),
        sa.CheckConstraint(
            "visibility_mode IN ('all', 'active', 'selected')",
            name="ck_kg_public_links_visibility_mode",
        ),
    )

    # Index on (scope_type, scope_id) for lookups by scope
    op.create_index(
        "ix_kg_public_links_scope",
        "kg_public_links",
        ["scope_type", "scope_id"],
    )

    # Index on is_active for filtering
    op.create_index(
        "ix_kg_public_links_is_active",
        "kg_public_links",
        ["is_active"],
    )

    # --- kg_public_link_nodes ---
    op.create_table(
        "kg_public_link_nodes",
        sa.Column("link_id", sa.Integer(), nullable=False),
        sa.Column("node_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("link_id", "node_id"),
        sa.ForeignKeyConstraint(
            ["link_id"],
            ["kg_public_links.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["node_id"],
            ["knowledge_nodes.id"],
            ondelete="CASCADE",
        ),
    )


def downgrade() -> None:
    op.drop_table("kg_public_link_nodes")

    op.drop_index("ix_kg_public_links_is_active", table_name="kg_public_links")
    op.drop_index("ix_kg_public_links_scope", table_name="kg_public_links")

    op.drop_table("kg_public_links")
