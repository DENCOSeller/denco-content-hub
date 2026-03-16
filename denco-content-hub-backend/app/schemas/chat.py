from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.chat import ChatRole

# --- ChatSession ---


class ChatSessionCreate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    page_context: dict | None = None


class ChatSessionResponse(BaseModel):
    id: int
    title: str | None = None
    page_context: dict | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- ChatAttachment ---


class ChatAttachmentResponse(BaseModel):
    id: int
    original_name: str
    content_type: str
    size_bytes: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- ChatMessage ---


class ChatMessageResponse(BaseModel):
    id: int
    session_id: int
    role: ChatRole
    content: str
    page_context: dict | None = None
    attachments: list[ChatAttachmentResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- ChatRequest (SSE) ---


class ChatRequest(BaseModel):
    session_id: int | None = None
    message: str = Field(max_length=10000)
    page_context: dict | None = None
    attachment_ids: list[int] | None = None


# --- AiSettings ---


class AiSettingsResponse(BaseModel):
    ai_master_prompt: str
    ai_max_tool_rounds: int
    ai_max_history_messages: int
    ai_rate_limit_per_hour: int
    ai_max_sessions_shown: int
    ai_provider: str
    ai_model: str


class AiSettingsUpdate(BaseModel):
    ai_master_prompt: str | None = None
    ai_max_tool_rounds: int | None = Field(default=None, gt=0, le=10)
    ai_max_history_messages: int | None = Field(default=None, gt=0, le=100)
    ai_rate_limit_per_hour: int | None = Field(default=None, gt=0, le=1000)
    ai_max_sessions_shown: int | None = Field(default=None, gt=0, le=500)
    ai_provider: str | None = Field(default=None, pattern=r"^(anthropic|openai|groq)$")
    ai_model: str | None = Field(default=None, max_length=100)
