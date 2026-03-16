from __future__ import annotations

import enum
from datetime import datetime  # noqa: TC003

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class Platform(enum.StrEnum):
    YOUTUBE = "youtube"
    INSTAGRAM = "instagram"
    TELEGRAM = "telegram"
    VK = "vk"


class ContentType(enum.StrEnum):
    SHORTS = "shorts"
    LONG_VIDEO = "long_video"
    REELS = "reels"
    POST = "post"
    CAROUSEL = "carousel"
    ARTICLE = "article"
    CLIP = "clip"


class Category(enum.StrEnum):
    REACH = "reach"
    EXPERT = "expert"
    SELLING = "selling"
    WARMING = "warming"


class LibrarySourceType(enum.StrEnum):
    REFERENCE = "reference"
    KNOWLEDGE = "knowledge"
    MANUAL = "manual"
    MIXED = "mixed"


class LibraryStatus(enum.StrEnum):
    DRAFT = "draft"
    READY = "ready"
    PUBLISHED = "published"


class LibraryItem(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "library_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="RESTRICT"), nullable=False)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)

    # Контент-параметры
    platform: Mapped[str] = mapped_column(String(20), nullable=False)
    content_type: Mapped[str] = mapped_column(String(30), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    hunt_level: Mapped[int] = mapped_column(Integer, nullable=False)

    # Расширенные параметры (опциональные, ссылки на узлы графа знаний)
    speaker_node_id: Mapped[int | None] = mapped_column(
        ForeignKey("knowledge_nodes.id", ondelete="SET NULL"), nullable=True
    )
    content_goal_node_id: Mapped[int | None] = mapped_column(
        ForeignKey("knowledge_nodes.id", ondelete="SET NULL"), nullable=True
    )
    narrative_node_id: Mapped[int | None] = mapped_column(
        ForeignKey("knowledge_nodes.id", ondelete="SET NULL"), nullable=True
    )
    hook_type_node_id: Mapped[int | None] = mapped_column(
        ForeignKey("knowledge_nodes.id", ondelete="SET NULL"), nullable=True
    )
    product_node_id: Mapped[int | None] = mapped_column(
        ForeignKey("knowledge_nodes.id", ondelete="SET NULL"), nullable=True
    )
    tone_node_id: Mapped[int | None] = mapped_column(
        ForeignKey("knowledge_nodes.id", ondelete="SET NULL"), nullable=True
    )

    # Источник
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source_reference_id: Mapped[int | None] = mapped_column(
        ForeignKey("content_items.id", ondelete="SET NULL"), nullable=True
    )
    source_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Контент
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    generated_content: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    edited_content: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    generation_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Статус и публикация
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=LibraryStatus.DRAFT)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Метрики
    metrics: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))

    __table_args__ = (
        CheckConstraint(
            "hunt_level >= 1 AND hunt_level <= 5",
            name="ck_library_items_hunt_level",
        ),
        Index(
            "ix_library_items_workspace",
            "workspace_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_library_items_workspace_status",
            "workspace_id",
            "status",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_library_items_workspace_platform",
            "workspace_id",
            "platform",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_library_items_created_by",
            "created_by_user_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
