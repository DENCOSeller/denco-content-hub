from __future__ import annotations

import enum
from datetime import datetime  # noqa: TC003

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class TrendStage(enum.StrEnum):
    rising = "rising"
    peaking = "peaking"
    declining = "declining"


class TrendAnalysisStatus(enum.StrEnum):
    new = "new"
    pending_analysis = "pending_analysis"
    analyzing = "analyzing"
    analyzed = "analyzed"
    skipped = "skipped"
    failed = "failed"


class TrendAlertType(enum.StrEnum):
    new_trend = "new_trend"
    viral_trend = "viral_trend"
    niche_spike = "niche_spike"


class TrendNiche(Base, TimestampMixin):
    __tablename__ = "trend_niches"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    keywords: Mapped[list] = mapped_column(ARRAY(String), nullable=False)
    platforms: Mapped[list] = mapped_column(ARRAY(String), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    monitoring_interval_hours: Mapped[int] = mapped_column(Integer, default=4, nullable=False)

    __table_args__ = (
        Index("ix_trend_niches_workspace", "workspace_id"),
        Index("ix_trend_niches_is_active", "is_active"),
    )


class TrendItem(Base, TimestampMixin):
    __tablename__ = "trend_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="RESTRICT"), nullable=False)
    niche_id: Mapped[int | None] = mapped_column(ForeignKey("trend_niches.id", ondelete="SET NULL"), nullable=True)
    platform: Mapped[str] = mapped_column(String(20), nullable=False)
    platform_post_id: Mapped[str] = mapped_column(String(255), nullable=False)
    post_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    title: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    channel_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    channel_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Metrics
    views_count: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    likes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comments_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    shares_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Scoring
    er_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    velocity: Mapped[float | None] = mapped_column(Float, nullable=True)
    acceleration: Mapped[float | None] = mapped_column(Float, nullable=True)
    viral_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    stage: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Links
    competitor_post_id: Mapped[int | None] = mapped_column(
        ForeignKey("competitor_posts.id", ondelete="SET NULL"), nullable=True
    )

    # Status
    analysis_status: Mapped[str] = mapped_column(String(30), default="new", nullable=False)
    raw_metadata: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    __table_args__ = (
        Index(
            "ix_trend_items_ws_platform_post",
            "workspace_id",
            "platform",
            "platform_post_id",
            unique=True,
        ),
        Index("ix_trend_items_viral_score", "viral_score"),
        Index("ix_trend_items_stage", "stage"),
        Index("ix_trend_items_detected_at", "detected_at"),
        Index("ix_trend_items_niche", "niche_id"),
        Index("ix_trend_items_analysis_status", "analysis_status"),
    )


class TrendSnapshot(Base):
    __tablename__ = "trend_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trend_item_id: Mapped[int] = mapped_column(ForeignKey("trend_items.id", ondelete="CASCADE"), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    views_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    likes_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comments_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    velocity: Mapped[float | None] = mapped_column(Float, nullable=True)
    viral_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    __table_args__ = (
        Index(
            "ix_trend_snapshots_item_recorded",
            "trend_item_id",
            "recorded_at",
        ),
    )


class TrendAlert(Base):
    __tablename__ = "trend_alerts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    niche_id: Mapped[int | None] = mapped_column(ForeignKey("trend_niches.id", ondelete="SET NULL"), nullable=True)
    trend_item_id: Mapped[int | None] = mapped_column(ForeignKey("trend_items.id", ondelete="SET NULL"), nullable=True)
    alert_type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    threshold_triggered: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index(
            "ix_trend_alerts_unread",
            "workspace_id",
            "is_read",
            postgresql_where=text("is_read = FALSE"),
        ),
        Index("ix_trend_alerts_created", "created_at"),
    )


class TrendAlertSettings(Base, TimestampMixin):
    __tablename__ = "trend_alert_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    min_viral_score: Mapped[float] = mapped_column(Float, default=70.0, nullable=False)
    min_growth_rate: Mapped[float] = mapped_column(Float, default=50.0, nullable=False)
    niche_ids: Mapped[list] = mapped_column(ARRAY(Integer), default=list, nullable=False)
    notify_new_trend: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_viral_trend: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_niche_spike: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("workspace_id", name="uq_trend_alert_settings_workspace"),
    )
