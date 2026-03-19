from __future__ import annotations

from datetime import datetime  # noqa: TC003

from pydantic import BaseModel, ConfigDict, Field

# ── Niche ────────────────────────────────────────────────────────────


class TrendNicheCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=500)
    keywords: list[str] = Field(..., min_length=1)
    platforms: list[str] = Field(..., min_length=1)
    monitoring_interval_hours: int = Field(4, ge=1, le=168)
    language: str | None = Field("ru", max_length=10)
    region: str | None = Field("RU", max_length=10)
    keyword_mode: str = Field("separate", pattern=r"^(separate|combined)$")


class TrendNicheUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=500)
    keywords: list[str] | None = None
    platforms: list[str] | None = None
    is_active: bool | None = None
    monitoring_interval_hours: int | None = Field(None, ge=1, le=168)
    language: str | None = Field(None, max_length=10)
    region: str | None = Field(None, max_length=10)
    keyword_mode: str | None = Field(None, pattern=r"^(separate|combined)$")


class TrendNicheResponse(BaseModel):
    id: int
    workspace_id: int
    name: str
    keywords: list[str]
    platforms: list[str]
    is_active: bool
    monitoring_interval_hours: int
    language: str | None
    region: str | None
    keyword_mode: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Trend Item ───────────────────────────────────────────────────────


class TrendItemResponse(BaseModel):
    id: int
    workspace_id: int
    niche_id: int | None
    platform: str
    platform_post_id: str
    post_url: str | None
    title: str | None
    description: str | None
    thumbnail_url: str | None
    channel_name: str | None
    channel_url: str | None
    duration_seconds: int | None
    orientation: str | None
    published_at: datetime | None
    detected_at: datetime
    views_count: int
    likes_count: int
    comments_count: int
    shares_count: int
    er_score: float | None
    velocity: float | None
    acceleration: float | None
    viral_score: float | None
    stage: str | None
    competitor_post_id: int | None
    analysis_status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TrendItemDetailResponse(TrendItemResponse):
    raw_metadata: dict


# ── Snapshot ─────────────────────────────────────────────────────────


class TrendSnapshotResponse(BaseModel):
    id: int
    trend_item_id: int
    recorded_at: datetime
    views_count: int | None
    likes_count: int | None
    comments_count: int | None
    velocity: float | None
    viral_score: float | None

    model_config = ConfigDict(from_attributes=True)


# ── Alert ────────────────────────────────────────────────────────────


class TrendAlertResponse(BaseModel):
    id: int
    workspace_id: int
    niche_id: int | None
    trend_item_id: int | None
    alert_type: str
    title: str
    body: str | None
    is_read: bool
    read_at: datetime | None
    threshold_triggered: dict | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Filters / Settings ──────────────────────────────────────────────


class TrendItemFilters(BaseModel):
    platform: str | None = None
    niche_id: int | None = None
    stage: str | None = None
    orientation: str | None = None
    min_viral_score: float | None = None
    sort_by: str | None = None


class TrendAlertSettingsResponse(BaseModel):
    id: int
    workspace_id: int
    is_enabled: bool
    min_viral_score: float
    min_growth_rate: float
    niche_ids: list[int]
    notify_new_trend: bool
    notify_viral_trend: bool
    notify_niche_spike: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TrendAlertSettingsUpdate(BaseModel):
    is_enabled: bool | None = None
    min_viral_score: float | None = Field(None, ge=0)
    min_growth_rate: float | None = Field(None, ge=0)
    niche_ids: list[int] | None = None
    notify_new_trend: bool | None = None
    notify_viral_trend: bool | None = None
    notify_niche_spike: bool | None = None


class TaskAcceptedResponse(BaseModel):
    status: str
    message: str
