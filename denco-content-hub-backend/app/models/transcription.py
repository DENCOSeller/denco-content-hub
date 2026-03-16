from __future__ import annotations

import enum
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.content_item import ContentItem


class TranscriptionStatus(enum.StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class DiarizationStatus(enum.StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Transcription(Base, TimestampMixin):
    __tablename__ = "transcriptions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    content_item_id: Mapped[int] = mapped_column(ForeignKey("content_items.id"), nullable=False)
    status: Mapped[TranscriptionStatus] = mapped_column(default=TranscriptionStatus.PENDING, nullable=False)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(nullable=True)
    whisper_model: Mapped[str | None] = mapped_column(String(20), nullable=True)
    segments: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(default=0, nullable=False)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    diarization_status: Mapped[DiarizationStatus | None] = mapped_column(nullable=True)
    diarization_celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    diarization_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    content_item: Mapped[ContentItem] = relationship(back_populates="transcription")

    __table_args__ = (
        Index(
            "uq_transcriptions_content_item_id",
            "content_item_id",
            unique=True,
        ),
        Index("ix_transcriptions_status", "status"),
    )
