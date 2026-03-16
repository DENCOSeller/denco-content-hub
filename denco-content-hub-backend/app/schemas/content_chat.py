from datetime import datetime

from pydantic import BaseModel, Field


class ChatMessageRequest(BaseModel):
    """Request to send a chat message about content."""

    message: str = Field(..., min_length=1, max_length=5000, description="User message text")


class ChatMessageResponse(BaseModel):
    """Single chat message response."""

    id: int
    role: str
    message: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatHistoryResponse(BaseModel):
    """Chat history for a content item."""

    messages: list[ChatMessageResponse]
