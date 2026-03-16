from __future__ import annotations

import enum
from datetime import datetime  # noqa: TC003

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class PlanItemStatus(enum.StrEnum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    CANCELLED = "cancelled"


class ContentPlanItem(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "content_plan_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="RESTRICT"), nullable=False)
    library_item_id: Mapped[int] = mapped_column(ForeignKey("library_items.id", ondelete="RESTRICT"), nullable=False)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Планирование
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Статус и платформа
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=PlanItemStatus.DRAFT)
    platform: Mapped[str] = mapped_column(String(20), nullable=False)

    # Заметки
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Метрики
    metrics: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))

    __table_args__ = (
        Index(
            "uq_content_plan_items_library_item_active",
            "library_item_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL AND status NOT IN ('cancelled', 'published')"),
        ),
        Index(
            "ix_content_plan_items_workspace",
            "workspace_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_content_plan_items_workspace_status",
            "workspace_id",
            "status",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_content_plan_items_scheduled",
            "workspace_id",
            "scheduled_at",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
