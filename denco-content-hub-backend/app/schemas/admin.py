from datetime import datetime

from pydantic import BaseModel


class StuckTranscriptionItem(BaseModel):
    transcription_id: int
    content_item_id: int
    stuck_since: datetime


class ResetStuckResponse(BaseModel):
    reset_count: int
    items: list[StuckTranscriptionItem]
