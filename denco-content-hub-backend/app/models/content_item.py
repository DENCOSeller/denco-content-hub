from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.content_analysis import ContentAnalysis
    from app.models.content_chat_message import ContentChatMessage
    from app.models.transcription import Transcription


class ContentStatus(enum.StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    DOWNLOADING = "downloading"
    COMPLETED = "completed"
    FAILED = "failed"


class SourceType(enum.StrEnum):
    YOUTUBE_VIDEO = "youtube_video"
    PDF_FILE = "pdf_file"
    WEB_PAGE = "web_page"
    MANUAL_TEXT = "manual_text"


class ContentItem(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "content_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), nullable=False)
    added_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Источник
    url: Mapped[str] = mapped_column("source_url", String(2048), nullable=False)
    source_type: Mapped[SourceType] = mapped_column(nullable=False)
    video_id: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Метаданные (заполняются после парсинга)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration: Mapped[int | None] = mapped_column(nullable=True)

    # YouTube метрики
    view_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    like_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comment_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    channel_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    # Извлечённый текст (для PDF, веб-страниц, manual text)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Статус обработки
    status: Mapped[ContentStatus] = mapped_column(default=ContentStatus.PENDING, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(default=0, nullable=False)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    processing_step: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Файлы (пути после скачивания)
    raw_file_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    audio_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    # Relationships
    transcription: Mapped[Transcription | None] = relationship(back_populates="content_item", uselist=False)
    analysis: Mapped[ContentAnalysis | None] = relationship(back_populates="content_item", uselist=False)
    chat_messages: Mapped[list[ContentChatMessage]] = relationship(
        back_populates="content_item", order_by="ContentChatMessage.created_at"
    )

    __table_args__ = (
        Index("ix_content_items_workspace_id", "workspace_id"),
        Index("ix_content_items_added_by", "added_by_user_id"),
        Index("ix_content_items_workspace_status", "workspace_id", "status"),
        Index(
            "ix_content_items_workspace_video",
            "workspace_id",
            "video_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL AND video_id IS NOT NULL"),
        ),
    )
