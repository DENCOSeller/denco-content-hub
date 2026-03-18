"""fix audience_insights and production_notes column type Text -> JSONB

Revision ID: fca9e7d7aeaf
Revises: 64a95c43ed7e
Create Date: 2026-03-18 22:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "fca9e7d7aeaf"
down_revision: str | None = "64a95c43ed7e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "content_intelligence",
        "audience_insights",
        existing_type=sa.Text(),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=True,
        postgresql_using="audience_insights::jsonb",
    )
    op.alter_column(
        "content_intelligence",
        "production_notes",
        existing_type=sa.Text(),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=True,
        postgresql_using="production_notes::jsonb",
    )


def downgrade() -> None:
    op.alter_column(
        "content_intelligence",
        "production_notes",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=sa.Text(),
        existing_nullable=True,
        postgresql_using="production_notes::text",
    )
    op.alter_column(
        "content_intelligence",
        "audience_insights",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=sa.Text(),
        existing_nullable=True,
        postgresql_using="audience_insights::text",
    )
