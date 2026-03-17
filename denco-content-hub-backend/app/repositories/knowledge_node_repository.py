from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar

from sqlalchemy import Column, func, or_, select, update

from app.models.knowledge import KgNodeTypeDef, KnowledgeNode
from app.models.library_item import LibraryItem
from app.models.workspace import Workspace
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class KnowledgeNodeRepository(BaseRepository[KnowledgeNode]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(KnowledgeNode, db)

    async def get_by_workspace(
        self,
        workspace_id: int,
        node_type_def_id: int | None = None,
        search: str | None = None,
        company_id: int | None = None,
    ) -> list[KnowledgeNode]:
        if company_id is not None:
            scope_filter = or_(
                KnowledgeNode.workspace_id == workspace_id,
                KnowledgeNode.company_id == company_id,
            )
        else:
            scope_filter = KnowledgeNode.workspace_id == workspace_id
        query = self._base_query().where(scope_filter)
        query = self._apply_filters(query, node_type_def_id, search)
        query = query.order_by(KnowledgeNode.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_company(
        self,
        company_id: int,
        node_type_def_id: int | None = None,
        search: str | None = None,
    ) -> list[KnowledgeNode]:
        query = self._base_query().where(KnowledgeNode.company_id == company_id)
        query = self._apply_filters(query, node_type_def_id, search)
        query = query.order_by(KnowledgeNode.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_graph_nodes(self, workspace_id: int, company_id: int) -> list[KnowledgeNode]:
        """Get all nodes for graph view: workspace + company scoped."""
        query = (
            self._base_query()
            .where(
                or_(
                    KnowledgeNode.workspace_id == workspace_id,
                    KnowledgeNode.company_id == company_id,
                )
            )
            .order_by(KnowledgeNode.created_at.desc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def batch_update_positions(
        self,
        workspace_id: int,
        positions: list[dict],
        company_id: int | None = None,
    ) -> int:
        """Bulk update node positions. Returns count of updated rows."""
        if company_id is not None:
            scope_filter = or_(
                KnowledgeNode.workspace_id == workspace_id,
                KnowledgeNode.company_id == company_id,
            )
        else:
            scope_filter = KnowledgeNode.workspace_id == workspace_id
        updated = 0
        for pos in positions:
            result = await self.db.execute(
                update(KnowledgeNode)
                .where(
                    KnowledgeNode.id == pos["node_id"],
                    scope_filter,
                    KnowledgeNode.deleted_at.is_(None),
                )
                .values(
                    position_x=pos["position_x"],
                    position_y=pos["position_y"],
                    is_position_fixed=True,
                )
            )
            updated += result.rowcount  # type: ignore[attr-defined]
        return updated

    async def batch_update_company_positions(self, company_id: int, positions: list[dict]) -> int:
        """Bulk update company node positions. Returns count of updated rows."""
        updated = 0
        for pos in positions:
            result = await self.db.execute(
                update(KnowledgeNode)
                .where(
                    KnowledgeNode.id == pos["node_id"],
                    KnowledgeNode.company_id == company_id,
                    KnowledgeNode.deleted_at.is_(None),
                )
                .values(
                    position_x=pos["position_x"],
                    position_y=pos["position_y"],
                    is_position_fixed=True,
                )
            )
            updated += result.rowcount  # type: ignore[attr-defined]
        return updated

    async def reset_positions(self, workspace_id: int, company_id: int | None = None) -> None:
        if company_id is not None:
            scope_filter = or_(
                KnowledgeNode.workspace_id == workspace_id,
                KnowledgeNode.company_id == company_id,
            )
        else:
            scope_filter = KnowledgeNode.workspace_id == workspace_id
        await self.db.execute(
            update(KnowledgeNode)
            .where(scope_filter, KnowledgeNode.deleted_at.is_(None))
            .values(is_position_fixed=False)
        )
        await self.db.flush()

    async def search_nodes(
        self,
        search: str | None,
        node_type_def_id: int | None,
        workspace_ids: list[int] | None,
        company_ids: list[int] | None,
        workspace_id: int | None = None,
        company_id: int | None = None,
        limit: int = 10,
    ) -> list[KnowledgeNode]:
        """Search nodes across allowed scopes with ILIKE."""
        limit = min(limit, 30)
        query = self._base_query()

        scope_filters = []
        if workspace_id is not None:
            scope_filters.append(KnowledgeNode.workspace_id == workspace_id)
        elif workspace_ids:
            scope_filters.append(KnowledgeNode.workspace_id.in_(workspace_ids))
        if company_id is not None:
            scope_filters.append(KnowledgeNode.company_id == company_id)
        elif company_ids:
            scope_filters.append(KnowledgeNode.company_id.in_(company_ids))
        if scope_filters:
            query = query.where(or_(*scope_filters))

        query = self._apply_filters(query, node_type_def_id, search)
        query = query.order_by(KnowledgeNode.created_at.desc()).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_workspace_overview(self, workspace_id: int, company_id: int | None = None) -> dict:
        """Node counts by type_def slug + lightweight node list (no content_text)."""
        if company_id is not None:
            scope_filter = or_(
                KnowledgeNode.workspace_id == workspace_id,
                KnowledgeNode.company_id == company_id,
            )
        else:
            scope_filter = KnowledgeNode.workspace_id == workspace_id
        query = (
            select(KnowledgeNode.id, KnowledgeNode.title, KgNodeTypeDef.slug)
            .outerjoin(KgNodeTypeDef, KnowledgeNode.node_type_def_id == KgNodeTypeDef.id)
            .where(scope_filter, KnowledgeNode.deleted_at.is_(None))
            .order_by(KnowledgeNode.created_at.desc())
        )
        result = await self.db.execute(query)
        rows = result.all()

        nodes_by_type: dict[str, int] = {}
        node_list: list[dict] = []
        for row in rows:
            type_str = row.slug or "unknown"
            nodes_by_type[type_str] = nodes_by_type.get(type_str, 0) + 1
            node_list.append({"id": row.id, "title": row.title, "type": type_str})
        return {
            "workspace_id": workspace_id,
            "total_nodes": len(rows),
            "nodes_by_type": nodes_by_type,
            "node_list": node_list,
        }

    async def get_company_overview(self, company_id: int) -> dict:
        """Node counts by type_def slug + lightweight node list for company scope."""
        query = (
            select(KnowledgeNode.id, KnowledgeNode.title, KgNodeTypeDef.slug)
            .outerjoin(KgNodeTypeDef, KnowledgeNode.node_type_def_id == KgNodeTypeDef.id)
            .where(
                KnowledgeNode.company_id == company_id,
                KnowledgeNode.deleted_at.is_(None),
            )
            .order_by(KnowledgeNode.created_at.desc())
        )
        result = await self.db.execute(query)
        rows = result.all()

        nodes_by_type: dict[str, int] = {}
        node_list: list[dict] = []
        for row in rows:
            type_str = row.slug or "unknown"
            nodes_by_type[type_str] = nodes_by_type.get(type_str, 0) + 1
            node_list.append({"id": row.id, "title": row.title, "type": type_str})
        return {
            "company_id": company_id,
            "total_nodes": len(rows),
            "nodes_by_type": nodes_by_type,
            "node_list": node_list,
        }

    async def search_across_workspaces(
        self,
        search: str,
        workspace_ids: list[int],
        node_type_def_id: int | None = None,
        limit: int = 10,
    ) -> list[tuple[KnowledgeNode, str]]:
        """Search nodes with workspace name join. Returns (node, workspace_name)."""
        limit = min(limit, 30)
        if not workspace_ids:
            return []
        query = (
            select(KnowledgeNode, Workspace.name)
            .join(Workspace, KnowledgeNode.workspace_id == Workspace.id)
            .where(
                KnowledgeNode.deleted_at.is_(None),
                KnowledgeNode.workspace_id.in_(workspace_ids),
            )
        )
        pattern = f"%{_escape_like(search)}%"
        query = query.where(
            or_(
                KnowledgeNode.title.ilike(pattern, escape="\\"),
                KnowledgeNode.content_text.ilike(pattern, escape="\\"),
            )
        )
        if node_type_def_id is not None:
            query = query.where(KnowledgeNode.node_type_def_id == node_type_def_id)
        query = query.order_by(KnowledgeNode.created_at.desc()).limit(limit)
        result = await self.db.execute(query)
        return list(result.tuples().all())

    # Маппинг node_type_def slug → FK поле в library_items
    _NODE_TYPE_FK_MAP: ClassVar[dict[str, Column]] = {  # type: ignore[type-arg]
        "speaker": LibraryItem.speaker_node_id,
        "content_goal": LibraryItem.content_goal_node_id,
        "narrative_format": LibraryItem.narrative_node_id,
        "hook_type": LibraryItem.hook_type_node_id,
        "tone_of_voice": LibraryItem.tone_node_id,
        "product_focus": LibraryItem.product_node_id,
    }

    async def get_usage_counts(self, node_ids: list[int], node_type_slug: str) -> dict[int, int]:
        """Count how many non-deleted library_items reference each node."""
        fk_col = self._NODE_TYPE_FK_MAP.get(node_type_slug)
        if not fk_col or not node_ids:
            return {}
        query = (
            select(fk_col, func.count()).where(fk_col.in_(node_ids), LibraryItem.deleted_at.is_(None)).group_by(fk_col)
        )
        result = await self.db.execute(query)
        return dict(result.tuples().all())

    @staticmethod
    def _apply_filters(query, node_type_def_id: int | None, search: str | None):
        if node_type_def_id is not None:
            query = query.where(KnowledgeNode.node_type_def_id == node_type_def_id)
        if search:
            pattern = f"%{_escape_like(search)}%"
            query = query.where(
                or_(
                    KnowledgeNode.title.ilike(pattern, escape="\\"),
                    KnowledgeNode.content_text.ilike(pattern, escape="\\"),
                )
            )
        return query
