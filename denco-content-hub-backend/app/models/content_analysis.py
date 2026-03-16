from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.content_item import ContentItem


class ContentAnalysis(Base, TimestampMixin):
    __tablename__ = "content_analyses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    content_item_id: Mapped[int] = mapped_column(ForeignKey("content_items.id", ondelete="CASCADE"), nullable=False)

    # Результаты анализа
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    theses: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    hooks: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    storyboard: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)

    # Статус обработки
    status: Mapped[str] = mapped_column(String(20), server_default="pending", nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    content_item: Mapped[ContentItem] = relationship(back_populates="analysis")

    __table_args__ = (
        Index(
            "ix_content_analyses_content_item_id",
            "content_item_id",
            unique=True,
        ),
        Index("ix_content_analyses_status", "status"),
    )
