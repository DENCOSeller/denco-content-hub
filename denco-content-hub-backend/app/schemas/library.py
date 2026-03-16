from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.library_item import (
    Category,
    ContentType,
    LibrarySourceType,
    LibraryStatus,
    Platform,
)


class LibraryItemCreate(BaseModel):
    """Create a library item."""

    platform: Platform
    content_type: ContentType
    category: Category
    hunt_level: int = Field(ge=1, le=5)
    source_type: LibrarySourceType
    source_reference_id: int | None = None
    source_text: str | None = None
    title: str | None = Field(default=None, max_length=500)

    # Расширенные параметры (ссылки на узлы графа знаний)
    speaker_node_id: int | None = None
    content_goal_node_id: int | None = None
    narrative_node_id: int | None = None
    hook_type_node_id: int | None = None
    product_node_id: int | None = None
    tone_node_id: int | None = None


class LibraryItemUpdate(BaseModel):
    """Update a library item."""

    edited_content: dict[str, Any] | None = None
    status: LibraryStatus | None = None
    title: str | None = Field(default=None, max_length=500)
    source_text: str | None = None

    # Расширенные параметры (ссылки на узлы графа знаний)
    speaker_node_id: int | None = None
    content_goal_node_id: int | None = None
    narrative_node_id: int | None = None
    hook_type_node_id: int | None = None
    product_node_id: int | None = None
    tone_node_id: int | None = None


class LibraryItemResponse(BaseModel):
    """Full library item response."""

    id: int
    workspace_id: int
    created_by_user_id: int

    platform: Platform
    content_type: ContentType
    category: Category
    hunt_level: int

    source_type: LibrarySourceType
    source_reference_id: int | None = None
    source_text: str | None = None

    # Расширенные параметры (ссылки на узлы графа знаний)
    speaker_node_id: int | None = None
    content_goal_node_id: int | None = None
    narrative_node_id: int | None = None
    hook_type_node_id: int | None = None
    product_node_id: int | None = None
    tone_node_id: int | None = None

    title: str | None = None
    generated_content: dict[str, Any] = {}
    edited_content: dict[str, Any] | None = None
    generation_prompt: str | None = None

    status: LibraryStatus
    published_at: datetime | None = None

    metrics: dict[str, Any] = {}

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LibraryItemFilters(BaseModel):
    """Library item list filter parameters."""

    platform: Platform | None = Field(default=None, description="Platform filter")
    content_type: ContentType | None = Field(default=None, description="Content type filter")
    category: Category | None = Field(default=None, description="Category filter")
    status: LibraryStatus | None = Field(default=None, description="Status filter")
    hunt_level: int | None = Field(default=None, ge=1, le=5, description="Hunt level filter")
    search: str | None = Field(default=None, max_length=200, description="Search by title and source_text")
