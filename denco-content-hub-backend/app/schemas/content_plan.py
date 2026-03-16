from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.content_plan_item import PlanItemStatus
from app.models.library_item import Platform


class ContentPlanItemCreate(BaseModel):
    """Создание элемента контент-плана."""

    library_item_id: int
    scheduled_at: datetime
    assignee_id: int | None = None
    notes: str | None = None


class ContentPlanItemUpdate(BaseModel):
    """Обновление элемента контент-плана. Статус меняется через dedicated endpoints."""

    scheduled_at: datetime | None = None
    assignee_id: int | None = None
    notes: str | None = None


class ContentPlanItemResponse(BaseModel):
    """Полный ответ элемента контент-плана."""

    id: int
    workspace_id: int
    library_item_id: int
    created_by_user_id: int
    assignee_id: int | None = None

    scheduled_at: datetime
    published_at: datetime | None = None

    status: PlanItemStatus
    platform: Platform
    notes: str | None = None

    metrics: dict[str, Any] = {}

    # Related library item info
    library_item_title: str | None = None
    library_item_platform: str | None = None
    library_item_content_type: str | None = None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ContentPlanItemFilters(BaseModel):
    """Фильтры для списка контент-плана."""

    date_from: date | None = Field(default=None, description="Дата от")
    date_to: date | None = Field(default=None, description="Дата до")
    status: PlanItemStatus | None = Field(default=None, description="Статус")
    platform: Platform | None = Field(default=None, description="Платформа")
    assignee_id: int | None = Field(default=None, description="ID исполнителя")


class ContentPlanMetricsUpdate(BaseModel):
    """Обновление метрик элемента контент-плана."""

    views: int | None = None
    reach: int | None = None
    likes: int | None = None
    comments: int | None = None
    shares: int | None = None
