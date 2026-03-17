from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import func, select

from app.models.knowledge import ChangeType, KnowledgeNode, KnowledgeNodeVersion
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class KnowledgeVersionRepository(BaseRepository[KnowledgeNodeVersion]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(KnowledgeNodeVersion, db)

    async def create_snapshot(
        self,
        node: KnowledgeNode,
        changed_by_user_id: int | None,
        change_type: ChangeType,
        change_summary: str | None = None,
    ) -> KnowledgeNodeVersion:
        """Snapshot current node state before modification."""
        version_number = await self._next_version_number(node.id)
        return await self.create(
            node_id=node.id,
            version_number=version_number,
            title=node.title,
            content=node.content,
            content_text=node.content_text,
            node_type=node.node_type,
            changed_by_user_id=changed_by_user_id,
            change_type=change_type,
            change_summary=change_summary,
            status=node.status,
            confidence=node.confidence,
        )

    async def get_versions(self, node_id: int, limit: int = 20) -> list[KnowledgeNodeVersion]:
        query = (
            select(KnowledgeNodeVersion)
            .where(KnowledgeNodeVersion.node_id == node_id)
            .order_by(KnowledgeNodeVersion.version_number.desc())
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def _next_version_number(self, node_id: int) -> int:
        query = select(func.coalesce(func.max(KnowledgeNodeVersion.version_number), 0)).where(
            KnowledgeNodeVersion.node_id == node_id
        )
        result = await self.db.execute(query)
        return result.scalar_one() + 1
