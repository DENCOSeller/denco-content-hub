from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.competitor import CompetitorPost
    from app.models.content_item import ContentItem
    from app.models.workspace import Workspace


class ContentIntelligence(Base, TimestampMixin):
    __tablename__ = "content_intelligence"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="RESTRICT"), nullable=False)

    # Полиморфный источник — ровно один NOT NULL
    content_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("content_items.id", ondelete="CASCADE"), nullable=True
    )
    competitor_post_id: Mapped[int | None] = mapped_column(
        ForeignKey("competitor_posts.id", ondelete="CASCADE"), nullable=True
    )
    trend_item_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)

    # Результаты анализа
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    hooks: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    topics: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    tone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    quality_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    content_ideas: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    key_points: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # Расширенные (опциональные)
    storyboard: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    audience_insights: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    production_notes: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    content_structure: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Метаданные
    status: Mapped[str] = mapped_column(String(20), server_default="pending", nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sections_requested: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    content_item: Mapped[ContentItem | None] = relationship("ContentItem", lazy="noload")
    competitor_post: Mapped[CompetitorPost | None] = relationship("CompetitorPost", lazy="noload")
    workspace: Mapped[Workspace] = relationship("Workspace", lazy="noload")

    __table_args__ = (
        CheckConstraint(
            "(CASE WHEN content_item_id IS NOT NULL THEN 1 ELSE 0 END) + "
            "(CASE WHEN competitor_post_id IS NOT NULL THEN 1 ELSE 0 END) + "
            "(CASE WHEN trend_item_id IS NOT NULL THEN 1 ELSE 0 END) = 1",
            name="ck_content_intelligence_one_source",
        ),
        Index(
            "ix_ci_content_item_id",
            "content_item_id",
            unique=True,
            postgresql_where="content_item_id IS NOT NULL",
        ),
        Index(
            "ix_ci_competitor_post_id",
            "competitor_post_id",
            unique=True,
            postgresql_where="competitor_post_id IS NOT NULL",
        ),
        Index("ix_ci_workspace_source", "workspace_id", "source_type"),
        Index("ix_ci_status", "status"),
    )
