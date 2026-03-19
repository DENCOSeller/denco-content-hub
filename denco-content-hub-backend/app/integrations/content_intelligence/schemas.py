from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

# --- Section schemas ---


class KeyPoint(BaseModel):
    """Single key point extracted from content."""

    point: str
    importance: str | None = None


class Hook(BaseModel):
    """Attention-grabbing hook found in content."""

    hook: str
    explanation: str


class ContentIdea(BaseModel):
    """Content idea inspired by the analyzed material."""

    idea: str
    angle: str


class ContentStructure(BaseModel):
    """Structural breakdown of the content."""

    format: str
    has_cta: bool = False
    cta_type: str | None = None
    opening_style: str | None = None


class StoryboardEntry(BaseModel):
    """Single storyboard block (for video content)."""

    topic: str
    purpose: str
    time_start: str | None = None
    time_end: str | None = None
    block_number: int | None = None


class AudienceInsight(BaseModel):
    """Insight about the target audience."""

    insight: str
    recommendation: str | None = None


class ProductionNote(BaseModel):
    """Production quality or technique note."""

    note: str
    category: str | None = None


class TopicTag(BaseModel):
    """Topic tag with optional category."""

    name: str
    category: str | None = None


# --- Result schema ---


class IntelligenceResult(BaseModel):
    """Full analysis result — all sections optional."""

    summary: str | None = None
    key_points: list[KeyPoint] | None = None
    hooks: list[Hook] | None = None
    topics: list[TopicTag] | None = None
    tone: str | None = None
    quality_score: float | None = Field(default=None, ge=0, le=10)
    content_ideas: list[ContentIdea] | None = None
    content_structure: ContentStructure | None = None
    storyboard: list[StoryboardEntry] | None = None
    audience_insights: list[AudienceInsight] | None = None
    production_notes: list[ProductionNote] | None = None


# --- API schemas ---


class IntelligenceRequest(BaseModel):
    """Request to run content intelligence analysis."""

    source_type: str = Field(description="reference | competitor_post | trend_item")
    force: bool = Field(default=False, description="Force re-analysis even if exists")


class IntelligenceResponse(BaseModel):
    """API response for content intelligence."""

    id: int
    workspace_id: int
    source_type: str
    content_item_id: int | None = None
    competitor_post_id: int | None = None
    trend_item_id: int | None = None

    summary: str | None = None
    key_points: list[KeyPoint] | None = None
    hooks: list[Hook] | None = None
    topics: list[TopicTag] | None = None
    tone: str | None = None
    quality_score: float | None = None
    content_ideas: list[ContentIdea] | None = None
    content_structure: ContentStructure | None = None
    storyboard: list[StoryboardEntry] | None = None
    audience_insights: list[AudienceInsight] | None = None
    production_notes: list[ProductionNote] | None = None

    status: str
    error_message: str | None = None
    model_used: str | None = None
    prompt_version: str | None = None
    sections_requested: list[str] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
