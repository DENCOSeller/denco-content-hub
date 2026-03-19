"""add youtube metrics and extended analysis fields

Revision ID: b9178608000d
Revises: d29c354bb0b1
Create Date: 2026-03-18 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b9178608000d"
down_revision: str | None = "d29c354bb0b1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. content_items — метрики YouTube видео
    op.add_column("content_items", sa.Column("view_count", sa.Integer(), nullable=True))
    op.add_column("content_items", sa.Column("like_count", sa.Integer(), nullable=True))
    op.add_column("content_items", sa.Column("comment_count", sa.Integer(), nullable=True))
    op.add_column("content_items", sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("content_items", sa.Column("channel_name", sa.String(length=500), nullable=True))
    op.add_column("content_items", sa.Column("thumbnail_url", sa.String(length=2048), nullable=True))

    # 2. content_analyses — расширенный AI анализ
    op.add_column(
        "content_analyses", sa.Column("content_ideas", postgresql.JSONB(astext_type=sa.Text()), nullable=True)
    )
    op.add_column("content_analyses", sa.Column("audience_insights", sa.Text(), nullable=True))
    op.add_column("content_analyses", sa.Column("production_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    # content_analyses
    op.drop_column("content_analyses", "production_notes")
    op.drop_column("content_analyses", "audience_insights")
    op.drop_column("content_analyses", "content_ideas")

    # content_items
    op.drop_column("content_items", "thumbnail_url")
    op.drop_column("content_items", "channel_name")
    op.drop_column("content_items", "published_at")
    op.drop_column("content_items", "comment_count")
    op.drop_column("content_items", "like_count")
    op.drop_column("content_items", "view_count")
