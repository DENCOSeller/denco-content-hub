from datetime import datetime

from pydantic import BaseModel, Field


class ThesisItem(BaseModel):
    title: str
    description: str


class HookItem(BaseModel):
    hook: str
    explanation: str


class StoryboardItem(BaseModel):
    topic: str
    purpose: str
    time_start: str | None = None
    time_end: str | None = None
    block_number: int | None = None


class ContentAnalysisResponse(BaseModel):
    """Full content analysis response."""

    id: int
    content_item_id: int
    summary: str | None = None
    theses: list[ThesisItem] | None = None
    hooks: list[HookItem] | None = None
    storyboard: list[StoryboardItem] | None = None
    status: str
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GenerateAnalysisRequest(BaseModel):
    """Request to generate or regenerate content analysis."""

    force_regenerate: bool = Field(default=False, description="Force regeneration even if analysis exists")
