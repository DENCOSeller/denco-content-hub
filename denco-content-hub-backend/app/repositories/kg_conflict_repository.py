from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import or_, select, update

from app.models.knowledge import KgConflict, KnowledgeNode
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class KgConflictRepository(BaseRepository[KgConflict]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(KgConflict, db)

    async def get_open_conflicts(self, workspace_id: int) -> list[KgConflict]:
        """Открытые конфликты для workspace (через workspace_node)."""
        query = (
            select(KgConflict)
            .join(
                KnowledgeNode,
                KgConflict.workspace_node_id == KnowledgeNode.id,
            )
            .where(
                KnowledgeNode.workspace_id == workspace_id,
                KgConflict.status == "open",
            )
            .order_by(KgConflict.created_at.desc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create(self, **kwargs: Any) -> KgConflict:
        """Создать конфликт."""
        instance = KgConflict(**kwargs)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def create_bulk(self, conflicts: list[dict[str, Any]]) -> list[KgConflict]:
        """Массовое создание конфликтов."""
        instances = [KgConflict(**data) for data in conflicts]
        self.db.add_all(instances)
        await self.db.flush()
        for inst in instances:
            await self.db.refresh(inst)
        return instances

    async def update_status(
        self,
        conflict_id: int,
        status: str,
        resolved_by_user_id: int | None = None,
        resolved_at: datetime | None = None,
    ) -> KgConflict:
        """Обновить статус конфликта."""
        return await self.update(
            conflict_id,
            status=status,
            resolved_by_user_id=resolved_by_user_id,
            resolved_at=resolved_at,
        )

    async def find_existing(
        self,
        company_node_id: int,
        workspace_node_id: int,
        conflict_type: str,
    ) -> KgConflict | None:
        """Найти открытый конфликт (чтобы не дублировать)."""
        query = select(KgConflict).where(
            KgConflict.company_node_id == company_node_id,
            KgConflict.workspace_node_id == workspace_node_id,
            KgConflict.conflict_type == conflict_type,
            KgConflict.status == "open",
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def dismiss_all_for_node(self, node_id: int) -> int:
        """Закрыть все открытые конфликты для узла."""
        now = datetime.now(UTC)
        result = await self.db.execute(
            update(KgConflict)
            .where(
                KgConflict.status == "open",
                or_(
                    KgConflict.company_node_id == node_id,
                    KgConflict.workspace_node_id == node_id,
                ),
            )
            .values(status="dismissed", resolved_at=now)
        )
        await self.db.flush()
        return result.rowcount  # type: ignore[attr-defined]
