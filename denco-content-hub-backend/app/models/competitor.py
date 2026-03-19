from __future__ import annotations

import enum
from datetime import datetime  # noqa: TC003

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class CompetitorPlatform(enum.StrEnum):
    youtube = "youtube"
    instagram = "instagram"
    telegram = "telegram"
    vk = "vk"


class CompetitorStatus(enum.StrEnum):
    active = "active"
    paused = "paused"
    error = "error"
    archived = "archived"


class CompetitorPostStatus(enum.StrEnum):
    new = "new"
    pending_analysis = "pending_analysis"
    analyzing = "analyzing"
    analyzed = "analyzed"
    skipped = "skipped"
    failed = "failed"


class NotificationType(enum.StrEnum):
    new_post = "new_post"
    viral_post = "viral_post"
    channel_growth = "channel_growth"


class CompetitorChannel(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "competitor_channels"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="RESTRICT"), nullable=False)
    added_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    platform: Mapped[str] = mapped_column(String(20), nullable=False)
    source_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    platform_id: Mapped[str] = mapped_column(String(255), nullable=False)
    handle: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    subscribers_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    posts_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_views: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_er: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    parse_frequency_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=12)
    last_parsed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    parse_config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    __table_args__ = (
        Index(
            "ix_competitor_channels_ws_platform_pid",
            "workspace_id",
            "platform",
            "platform_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_competitor_channels_workspace",
            "workspace_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("ix_competitor_channels_status", "status"),
        Index("ix_competitor_channels_last_parsed", "last_parsed_at"),
    )


class CompetitorPost(Base, TimestampMixin):
    __tablename__ = "competitor_posts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    channel_id: Mapped[int] = mapped_column(ForeignKey("competitor_channels.id", ondelete="CASCADE"), nullable=False)
    platform_post_id: Mapped[str] = mapped_column(String(255), nullable=False)
    post_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    title: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    views_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    likes_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comments_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    shares_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    er_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    raw_metadata: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    analysis_status: Mapped[str] = mapped_column(String(30), nullable=False, default="new")
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    analysis_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_to_library: Mapped[bool] = mapped_column(default=False, nullable=False)
    library_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("library_items.id", ondelete="SET NULL"), nullable=True
    )

    __table_args__ = (
        Index(
            "ix_competitor_posts_channel_post",
            "channel_id",
            "platform_post_id",
            unique=True,
        ),
        Index("ix_competitor_posts_channel", "channel_id"),
        Index("ix_competitor_posts_published", "published_at"),
        Index(
            "ix_competitor_posts_channel_published",
            "channel_id",
            "published_at",
        ),
        Index("ix_competitor_posts_analysis_status", "analysis_status"),
    )


class CompetitorChannelSnapshot(Base):
    __tablename__ = "competitor_channel_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    channel_id: Mapped[int] = mapped_column(ForeignKey("competitor_channels.id", ondelete="CASCADE"), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    subscribers_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    posts_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_views_30d: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_er_30d: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_views_30d: Mapped[int | None] = mapped_column(Integer, nullable=True)
    posts_count_30d: Mapped[int | None] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        Index(
            "ix_competitor_snapshots_channel_recorded",
            "channel_id",
            "recorded_at",
        ),
    )


class CompetitorNotification(Base, TimestampMixin):
    __tablename__ = "competitor_notifications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    channel_id: Mapped[int] = mapped_column(ForeignKey("competitor_channels.id", ondelete="CASCADE"), nullable=False)
    post_id: Mapped[int | None] = mapped_column(ForeignKey("competitor_posts.id", ondelete="CASCADE"), nullable=True)
    notification_type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_read: Mapped[bool] = mapped_column(default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index(
            "ix_competitor_notifications_unread",
            "workspace_id",
            "is_read",
            postgresql_where=text("is_read = FALSE"),
        ),
        Index("ix_competitor_notifications_workspace", "workspace_id"),
    )
