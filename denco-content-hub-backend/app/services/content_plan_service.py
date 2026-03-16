from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

import structlog

from app.exceptions import BadRequestException, ConflictException
from app.models.content_plan_item import ContentPlanItem, PlanItemStatus
from app.models.library_item import LibraryStatus
from app.repositories.content_plan_repository import ContentPlanItemRepository
from app.repositories.library_repository import LibraryItemRepository
from app.repositories.workspace_member_repository import (
    WorkspaceMemberRepository,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams
    from app.schemas.content_plan import (
        ContentPlanItemCreate,
        ContentPlanItemFilters,
        ContentPlanItemUpdate,
        ContentPlanMetricsUpdate,
    )

logger = structlog.get_logger()


class ContentPlanService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ContentPlanItemRepository(db)
        self.library_repo = LibraryItemRepository(db)
        self.member_repo = WorkspaceMemberRepository(db)

    async def create_plan_item(
        self,
        workspace_id: int,
        user_id: int,
        data: ContentPlanItemCreate,
    ) -> ContentPlanItem:
        """Создать элемент контент-плана."""
        # Проверить что library item существует в воркспейсе
        library_item = await self.library_repo.get_by_id_in_workspace(
            workspace_id,
            data.library_item_id,
        )

        # Проверить дубли — только активные записи
        existing = await self.repo.get_active_by_library_item_id(
            data.library_item_id,
        )
        if existing is not None:
            raise ConflictException(
                "Library item already has an active plan item",
            )

        # Валидация assignee
        if data.assignee_id is not None:
            await self._validate_assignee(workspace_id, data.assignee_id)

        # Создать plan item
        plan_item = await self.repo.create(
            workspace_id=workspace_id,
            data={
                "created_by_user_id": user_id,
                "platform": library_item.platform,
                **data.model_dump(exclude_unset=True),
            },
        )

        # Синхронизировать статус library item → scheduled
        if library_item.status in (
            LibraryStatus.READY,
            LibraryStatus.DRAFT,
        ):
            library_item.status = LibraryStatus.SCHEDULED
            await self.db.flush()

        await self.db.commit()
        await self.db.refresh(plan_item)
        logger.info(
            "Content plan item created",
            plan_item_id=plan_item.id,
            library_item_id=data.library_item_id,
            workspace_id=workspace_id,
        )
        return plan_item

    async def get_plan_item(
        self,
        workspace_id: int,
        item_id: int,
    ) -> ContentPlanItem:
        """Получить элемент контент-плана."""
        return await self.repo.get_by_id_in_workspace(workspace_id, item_id)

    async def get_plan_items(
        self,
        workspace_id: int,
        filters: ContentPlanItemFilters,
        pagination: PaginationParams,
    ) -> PaginatedResponse[ContentPlanItem]:
        """Получить список элементов контент-плана."""
        return await self.repo.list(
            workspace_id=workspace_id,
            filters=filters,
            pagination=pagination,
        )

    async def update_plan_item(
        self,
        workspace_id: int,
        item_id: int,
        data: ContentPlanItemUpdate,
    ) -> ContentPlanItem:
        """Обновить элемент контент-плана."""
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return await self.repo.get_by_id_in_workspace(
                workspace_id,
                item_id,
            )

        # Валидация assignee
        if data.assignee_id is not None:
            await self._validate_assignee(workspace_id, data.assignee_id)

        plan_item = await self.repo.update_in_workspace(
            workspace_id=workspace_id,
            item_id=item_id,
            data=update_data,
        )
        await self.db.commit()
        await self.db.refresh(plan_item)
        logger.info(
            "Content plan item updated",
            plan_item_id=item_id,
            workspace_id=workspace_id,
        )
        return plan_item

    async def delete_plan_item(
        self,
        workspace_id: int,
        item_id: int,
    ) -> None:
        """Soft delete элемента контент-плана + откат статуса library item."""
        plan_item = await self.repo.get_by_id_in_workspace(
            workspace_id,
            item_id,
        )

        # Откат статуса library item → ready
        library_item = await self.library_repo.get_by_id_in_workspace(
            workspace_id,
            plan_item.library_item_id,
        )
        if library_item.status == LibraryStatus.SCHEDULED:
            library_item.status = LibraryStatus.READY
            await self.db.flush()

        await self.repo.soft_delete_in_workspace(workspace_id, item_id)
        await self.db.commit()
        logger.info(
            "Content plan item deleted",
            plan_item_id=item_id,
            workspace_id=workspace_id,
        )

    async def publish_plan_item(
        self,
        workspace_id: int,
        item_id: int,
    ) -> ContentPlanItem:
        """Опубликовать элемент контент-плана."""
        plan_item = await self.repo.get_by_id_in_workspace(
            workspace_id,
            item_id,
        )

        if plan_item.status not in (PlanItemStatus.DRAFT, PlanItemStatus.SCHEDULED):
            raise BadRequestException(
                f"Cannot publish plan item with status '{plan_item.status}'"
            )

        now = datetime.now(UTC)

        # Обновить plan item
        plan_item = await self.repo.update_in_workspace(
            workspace_id=workspace_id,
            item_id=item_id,
            data={
                "status": PlanItemStatus.PUBLISHED,
                "published_at": now,
            },
        )

        # Синхронизировать library item → published
        library_item = await self.library_repo.get_by_id_in_workspace(
            workspace_id,
            plan_item.library_item_id,
        )
        library_item.status = LibraryStatus.PUBLISHED
        library_item.published_at = now
        await self.db.flush()

        await self.db.commit()
        await self.db.refresh(plan_item)
        logger.info(
            "Content plan item published",
            plan_item_id=item_id,
            workspace_id=workspace_id,
        )
        return plan_item

    async def update_metrics(
        self,
        workspace_id: int,
        item_id: int,
        data: ContentPlanMetricsUpdate,
    ) -> ContentPlanItem:
        """Обновить метрики элемента контент-плана."""
        plan_item = await self.repo.get_by_id_in_workspace(
            workspace_id,
            item_id,
        )

        # Мержим с существующими метриками
        current_metrics = plan_item.metrics or {}
        new_metrics = data.model_dump(exclude_unset=True)
        current_metrics.update(new_metrics)

        plan_item = await self.repo.update_in_workspace(
            workspace_id=workspace_id,
            item_id=item_id,
            data={"metrics": current_metrics},
        )
        await self.db.commit()
        await self.db.refresh(plan_item)
        logger.info(
            "Content plan item metrics updated",
            plan_item_id=item_id,
            workspace_id=workspace_id,
        )
        return plan_item

    async def _validate_assignee(
        self,
        workspace_id: int,
        assignee_id: int,
    ) -> None:
        """Проверить что assignee — член воркспейса."""
        membership = await self.member_repo.get_membership(
            user_id=assignee_id,
            workspace_id=workspace_id,
        )
        if membership is None:
            raise BadRequestException(
                "Assignee is not a member of this workspace",
            )
