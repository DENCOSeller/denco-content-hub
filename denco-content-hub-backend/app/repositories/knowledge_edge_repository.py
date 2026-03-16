from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import or_, select, update

from app.models.knowledge import KnowledgeEdge, KnowledgeNode
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class KnowledgeEdgeRepository(BaseRepository[KnowledgeEdge]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(KnowledgeEdge, db)

    async def get_for_node_ids(self, node_ids: list[int]) -> list[KnowledgeEdge]:
        """Get all edges where both source and target are in node_ids."""
        if not node_ids:
            return []
        query = (
            self._base_query()
            .where(
                KnowledgeEdge.source_node_id.in_(node_ids),
                KnowledgeEdge.target_node_id.in_(node_ids),
            )
            .order_by(KnowledgeEdge.created_at.desc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_source_or_target(self, node_id: int) -> list[KnowledgeEdge]:
        """Get all edges connected to a node (for cascade delete)."""
        query = self._base_query().where(
            or_(
                KnowledgeEdge.source_node_id == node_id,
                KnowledgeEdge.target_node_id == node_id,
            )
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def soft_delete_by_node(self, node_id: int) -> int:
        """Bulk soft-delete all edges connected to a node."""
        now = datetime.now(UTC)
        result = await self.db.execute(
            update(KnowledgeEdge)
            .where(
                KnowledgeEdge.deleted_at.is_(None),
                or_(
                    KnowledgeEdge.source_node_id == node_id,
                    KnowledgeEdge.target_node_id == node_id,
                ),
            )
            .values(deleted_at=now)
        )
        await self.db.flush()
        return result.rowcount  # type: ignore[attr-defined]

    async def get_edges_for_node(self, node_id: int) -> list[dict]:
        """Get edges with connected node info for a single node."""
        source_node = select(KnowledgeNode).subquery("src")
        target_node = select(KnowledgeNode).subquery("tgt")

        # Outgoing edges: this node is source
        out_query = (
            select(
                KnowledgeEdge.id,
                KnowledgeEdge.label,
                target_node.c.id.label("connected_node_id"),
                target_node.c.title.label("connected_node_title"),
                target_node.c.node_type.label("connected_node_type"),
            )
            .join(target_node, KnowledgeEdge.target_node_id == target_node.c.id)
            .where(
                KnowledgeEdge.source_node_id == node_id,
                KnowledgeEdge.deleted_at.is_(None),
                target_node.c.deleted_at.is_(None),
            )
        )
        out_result = await self.db.execute(out_query)
        edges: list[dict] = [
            {
                "id": r.id,
                "label": r.label,
                "connected_node_id": r.connected_node_id,
                "connected_node_title": r.connected_node_title,
                "connected_node_type": str(r.connected_node_type),
                "direction": "outgoing",
            }
            for r in out_result.all()
        ]

        # Incoming edges: this node is target
        in_query = (
            select(
                KnowledgeEdge.id,
                KnowledgeEdge.label,
                source_node.c.id.label("connected_node_id"),
                source_node.c.title.label("connected_node_title"),
                source_node.c.node_type.label("connected_node_type"),
            )
            .join(source_node, KnowledgeEdge.source_node_id == source_node.c.id)
            .where(
                KnowledgeEdge.target_node_id == node_id,
                KnowledgeEdge.deleted_at.is_(None),
                source_node.c.deleted_at.is_(None),
            )
        )
        in_result = await self.db.execute(in_query)
        edges.extend(
            {
                "id": r.id,
                "label": r.label,
                "connected_node_id": r.connected_node_id,
                "connected_node_title": r.connected_node_title,
                "connected_node_type": str(r.connected_node_type),
                "direction": "incoming",
            }
            for r in in_result.all()
        )
        return edges

    async def get_duplicate(self, source_node_id: int, target_node_id: int, label: str) -> KnowledgeEdge | None:
        query = self._base_query().where(
            KnowledgeEdge.source_node_id == source_node_id,
            KnowledgeEdge.target_node_id == target_node_id,
            KnowledgeEdge.label == label,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
