from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TranscriptionSegment(BaseModel):
    """Single transcription segment with timecodes."""

    start: float
    end: float
    text: str
    speaker: str | None = None


class TranscriptionResponse(BaseModel):
    """Full transcription response."""

    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    content_item_id: int
    status: str
    text: str | None = None
    language: str | None = None
    duration_seconds: int | None = None
    segments: list[TranscriptionSegment] | None = None
    whisper_model: str | None = None
    error_message: str | None = None
    diarization_status: str | None = None
    diarization_error: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class TranscriptionShortResponse(BaseModel):
    """Short transcription info for content lists."""

    model_config = ConfigDict(from_attributes=True)

    status: str
    language: str | None = None
    duration_seconds: int | None = None
    diarization_status: str | None = None
