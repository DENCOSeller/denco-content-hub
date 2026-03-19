from __future__ import annotations

from datetime import datetime  # noqa: TC003

from pydantic import BaseModel, ConfigDict, Field

from app.models.competitor import CompetitorStatus  # noqa: TC001


class CompetitorChannelCreate(BaseModel):
    url: str = Field(..., min_length=5, max_length=2048)


class CompetitorChannelUpdate(BaseModel):
    status: CompetitorStatus | None = None
    parse_frequency_hours: int | None = Field(None, ge=1, le=168)


class CompetitorChannelResponse(BaseModel):
    id: int
    workspace_id: int
    platform: str
    source_url: str
    platform_id: str
    handle: str | None
    display_name: str | None
    avatar_url: str | None
    description: str | None
    subscribers_count: int | None
    posts_count: int | None
    avg_views: float | None
    avg_er: float | None
    status: str
    parse_frequency_hours: int
    last_parsed_at: datetime | None
    error_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CompetitorPostResponse(BaseModel):
    id: int
    channel_id: int
    platform_post_id: str
    post_url: str
    title: str | None
    description: str | None
    thumbnail_url: str | None
    duration_seconds: int | None
    content_type: str | None
    published_at: datetime
    views_count: int | None
    likes_count: int | None
    comments_count: int | None
    shares_count: int | None
    er_score: float | None
    analysis_status: str
    sent_to_library: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CompetitorPostDetailResponse(CompetitorPostResponse):
    pass


class ResolveUrlRequest(BaseModel):
    url: str = Field(..., min_length=5, max_length=2048)


class ResolveUrlResponse(BaseModel):
    platform: str
    platform_id: str
    handle: str | None


class SyncResponse(BaseModel):
    status: str
    message: str


class CompetitorPostFilters(BaseModel):
    channel_id: int | None = None
    content_type: str | None = None
    analysis_status: str | None = None
    min_views: int | None = None


class CompetitorChannelSnapshotResponse(BaseModel):
    id: int
    channel_id: int
    recorded_at: datetime
    subscribers_count: int | None
    posts_count: int | None
    avg_views_30d: float | None
    avg_er_30d: float | None
    total_views_30d: int | None
    posts_count_30d: int | None

    model_config = ConfigDict(from_attributes=True)


class CompetitorNotificationResponse(BaseModel):
    id: int
    workspace_id: int
    channel_id: int
    post_id: int | None
    notification_type: str
    title: str
    body: str | None
    is_read: bool
    read_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
