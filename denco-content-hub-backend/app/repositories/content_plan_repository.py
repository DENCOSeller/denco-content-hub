from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import and_

from app.exceptions import NotFoundException
from app.models.content_plan_item import ContentPlanItem, PlanItemStatus
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams
    from app.schemas.content_plan import ContentPlanItemFilters


class ContentPlanItemRepository(BaseRepository[ContentPlanItem]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(ContentPlanItem, db)

    async def get_by_id_in_workspace(
        self,
        workspace_id: int,
        item_id: int,
    ) -> ContentPlanItem:
        """Получить элемент контент-плана по ID в рамках воркспейса."""
        query = (
            self._base_query().where(ContentPlanItem.workspace_id == workspace_id).where(ContentPlanItem.id == item_id)
        )
        result = await self.db.execute(query)
        instance = result.scalar_one_or_none()
        if instance is None:
            raise NotFoundException("ContentPlanItem not found")
        return instance

    async def list(
        self,
        workspace_id: int,
        filters: ContentPlanItemFilters,
        pagination: PaginationParams,
    ) -> PaginatedResponse[ContentPlanItem]:
        """Список элементов контент-плана с фильтрами."""
        query = self._base_query().where(
            ContentPlanItem.workspace_id == workspace_id,
        )

        if filters.date_from is not None:
            query = query.where(
                ContentPlanItem.scheduled_at >= filters.date_from,
            )
        if filters.date_to is not None:
            query = query.where(
                ContentPlanItem.scheduled_at <= filters.date_to,
            )
        if filters.status is not None:
            query = query.where(ContentPlanItem.status == filters.status)
        if filters.platform is not None:
            query = query.where(
                ContentPlanItem.platform == filters.platform,
            )
        if filters.assignee_id is not None:
            query = query.where(
                ContentPlanItem.assignee_id == filters.assignee_id,
            )

        query = query.order_by(ContentPlanItem.scheduled_at.asc())
        return await self.paginate(query, pagination)

    async def create(
        self,
        workspace_id: int,
        data: dict[str, Any],
    ) -> ContentPlanItem:
        """Создать элемент контент-плана."""
        return await super().create(workspace_id=workspace_id, **data)

    async def update_in_workspace(
        self,
        workspace_id: int,
        item_id: int,
        data: dict[str, Any],
    ) -> ContentPlanItem:
        """Обновить элемент контент-плана в рамках воркспейса."""
        instance = await self.get_by_id_in_workspace(workspace_id, item_id)
        for key, value in data.items():
            setattr(instance, key, value)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def soft_delete_in_workspace(
        self,
        workspace_id: int,
        item_id: int,
    ) -> ContentPlanItem:
        """Soft delete элемента контент-плана."""
        instance = await self.get_by_id_in_workspace(workspace_id, item_id)
        instance.deleted_at = datetime.now(UTC)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def get_active_by_library_item_id(
        self,
        library_item_id: int,
    ) -> ContentPlanItem | None:
        """Найти активный plan item для library item (не deleted/cancelled/published)."""
        query = self._base_query().where(
            and_(
                ContentPlanItem.library_item_id == library_item_id,
                ContentPlanItem.status.notin_(
                    [
                        PlanItemStatus.CANCELLED,
                        PlanItemStatus.PUBLISHED,
                    ]
                ),
            ),
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
