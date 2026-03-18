from datetime import datetime
from enum import StrEnum
from urllib.parse import urlparse

from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.schemas.transcription import TranscriptionShortResponse


class SourceTypeForm(StrEnum):
    """Allowed source types for /source endpoint."""

    YOUTUBE_VIDEO = "youtube_video"
    PDF_FILE = "pdf_file"
    WEB_PAGE = "web_page"
    MANUAL_TEXT = "manual_text"


# Белый список доменов — единый источник правды (R3 fix)
YOUTUBE_ALLOWED_HOSTS = frozenset(
    {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtu.be",
    }
)


class AddContentRequest(BaseModel):
    """Add content by URL."""

    url: HttpUrl

    @field_validator("url")
    @classmethod
    def validate_youtube_url(cls, v: HttpUrl) -> HttpUrl:
        parsed = urlparse(str(v))

        if parsed.scheme not in ("http", "https"):
            raise ValueError("Only HTTP/HTTPS URLs are supported")

        if parsed.hostname not in YOUTUBE_ALLOWED_HOSTS:
            raise ValueError("Only YouTube URLs are supported (youtube.com, youtu.be, m.youtube.com)")

        return v


class ContentItemResponse(BaseModel):
    """Full content item response."""

    id: int
    workspace_id: int
    added_by_user_id: int
    url: str
    source_type: str
    video_id: str | None = None

    # Метаданные
    title: str | None = None
    description: str | None = None
    duration: int | None = None

    # YouTube метрики
    view_count: int | None = None
    like_count: int | None = None
    comment_count: int | None = None
    published_at: datetime | None = None
    channel_name: str | None = None
    thumbnail_url: str | None = None

    # Статус
    status: str
    processing_step: str | None = None
    error_message: str | None = None

    # Файлы
    raw_file_path: str | None = None
    audio_path: str | None = None

    # Transcription
    transcription: TranscriptionShortResponse | None = None

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContentItemShortResponse(BaseModel):
    """Short response for lists."""

    id: int
    url: str
    source_type: str
    status: str
    processing_step: str | None = None
    title: str | None = None
    video_id: str | None = None
    duration: int | None = None
    thumbnail_url: str | None = None
    channel_name: str | None = None
    published_at: datetime | None = None
    view_count: int | None = None
    like_count: int | None = None
    comment_count: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ContentListFilters(BaseModel):
    """Content list filter parameters."""

    status: str | None = Field(default=None, description="pending | processing | completed | failed")
    source_type: str | None = Field(default=None, description="youtube_video")
    search: str | None = Field(default=None, max_length=200, description="Search by title")
