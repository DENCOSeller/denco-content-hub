from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.exceptions import ConflictException, ForbiddenException
from app.models.knowledge import ChangeType, KnowledgeNode, NodeType, ScopeType
from app.repositories.knowledge_edge_repository import KnowledgeEdgeRepository
from app.repositories.knowledge_node_repository import KnowledgeNodeRepository
from app.repositories.knowledge_version_repository import KnowledgeVersionRepository
from app.repositories.workspace_repository import WorkspaceRepository
from app.schemas.knowledge import (
    KnowledgeEdgeCreate,
    KnowledgeEdgeResponse,
    KnowledgeGraphResponse,
    KnowledgeNodeCreate,
    KnowledgeNodeResponse,
    KnowledgeNodeUpdate,
    KnowledgeNodeVersionResponse,
)
from app.utils.tiptap import tiptap_to_text

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


class KnowledgeService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.node_repo = KnowledgeNodeRepository(db)
        self.edge_repo = KnowledgeEdgeRepository(db)
        self.version_repo = KnowledgeVersionRepository(db)
        self.workspace_repo = WorkspaceRepository(db)

    # --- Nodes ---

    async def create_node(
        self,
        data: KnowledgeNodeCreate,
        user_id: int,
        *,
        workspace_id: int | None = None,
        company_id: int | None = None,
    ) -> KnowledgeNodeResponse:
        scope_type, scope_kwargs = self._resolve_scope(workspace_id, company_id)
        content_text = tiptap_to_text(data.content) if data.content else None

        node = await self.node_repo.create(
            node_type=data.node_type,
            title=data.title,
            content=data.content,
            content_text=content_text,
            scope_type=scope_type,
            created_by_user_id=user_id,
            updated_by_user_id=user_id,
            position_x=data.position_x,
            position_y=data.position_y,
            color=data.color,
            **scope_kwargs,
        )
        await self.version_repo.create_snapshot(node, changed_by_user_id=user_id, change_type=ChangeType.CREATED)
        await self.db.commit()
        logger.info("Knowledge node created", node_id=node.id, scope=scope_type)
        return KnowledgeNodeResponse.model_validate(node)

    async def update_node(self, node_id: int, data: KnowledgeNodeUpdate, user_id: int) -> KnowledgeNodeResponse:
        node = await self.node_repo.get_by_id(node_id)
        await self.version_repo.create_snapshot(node, changed_by_user_id=user_id, change_type=ChangeType.UPDATED)

        update_data = data.model_dump(exclude_unset=True)
        if "content" in update_data:
            update_data["content_text"] = tiptap_to_text(update_data["content"])
        update_data["updated_by_user_id"] = user_id

        node = await self.node_repo.update(node_id, **update_data)
        await self.db.commit()
        logger.info("Knowledge node updated", node_id=node_id)
        return KnowledgeNodeResponse.model_validate(node)

    async def delete_node(self, node_id: int) -> None:
        await self.node_repo.get_by_id(node_id)
        await self.edge_repo.soft_delete_by_node(node_id)
        await self.node_repo.soft_delete(node_id)
        await self.db.commit()
        logger.info("Knowledge node deleted", node_id=node_id)

    async def get_node(self, node_id: int) -> KnowledgeNodeResponse:
        node = await self.node_repo.get_by_id(node_id)
        return KnowledgeNodeResponse.model_validate(node)

    async def get_workspace_nodes(
        self,
        workspace_id: int,
        node_type: NodeType | None = None,
        search: str | None = None,
    ) -> list[KnowledgeNodeResponse]:
        workspace = await self.workspace_repo.get_by_id(workspace_id)
        nodes = await self.node_repo.get_by_workspace(
            workspace_id,
            node_type,
            search,
            company_id=workspace.company_id,
        )
        return [KnowledgeNodeResponse.model_validate(n) for n in nodes]

    async def get_company_nodes(
        self,
        company_id: int,
        node_type: NodeType | None = None,
        search: str | None = None,
    ) -> list[KnowledgeNodeResponse]:
        nodes = await self.node_repo.get_by_company(company_id, node_type, search)
        return [KnowledgeNodeResponse.model_validate(n) for n in nodes]

    # --- Graph ---

    async def get_workspace_graph(self, workspace_id: int) -> KnowledgeGraphResponse:
        workspace = await self.workspace_repo.get_by_id(workspace_id)
        nodes = await self.node_repo.get_graph_nodes(workspace_id, workspace.company_id)
        return await self._build_graph_response(nodes)

    async def get_company_graph(self, company_id: int) -> KnowledgeGraphResponse:
        nodes = await self.node_repo.get_by_company(company_id)
        return await self._build_graph_response(nodes)

    async def _build_graph_response(self, nodes: list[KnowledgeNode]) -> KnowledgeGraphResponse:
        node_ids = [n.id for n in nodes]
        edges = await self.edge_repo.get_for_node_ids(node_ids)
        return KnowledgeGraphResponse(
            nodes=[KnowledgeNodeResponse.model_validate(n) for n in nodes],
            edges=[KnowledgeEdgeResponse.model_validate(e) for e in edges],
        )

    # --- Edges ---

    async def create_edge(self, data: KnowledgeEdgeCreate, user_id: int) -> KnowledgeEdgeResponse:
        source = await self.node_repo.get_by_id(data.source_node_id)
        target = await self.node_repo.get_by_id(data.target_node_id)
        await self._validate_edge_scope(source, target)

        duplicate = await self.edge_repo.get_duplicate(data.source_node_id, data.target_node_id, data.label)
        if duplicate:
            raise ConflictException("Edge with this label already exists between these nodes")

        edge = await self.edge_repo.create(
            source_node_id=data.source_node_id,
            target_node_id=data.target_node_id,
            label=data.label,
            description=data.description,
            weight=data.weight,
            created_by_user_id=user_id,
        )
        await self.db.commit()
        logger.info("Knowledge edge created", edge_id=edge.id)
        return KnowledgeEdgeResponse.model_validate(edge)

    async def delete_edge(self, edge_id: int) -> None:
        await self.edge_repo.get_by_id(edge_id)
        await self.edge_repo.soft_delete(edge_id)
        await self.db.commit()
        logger.info("Knowledge edge deleted", edge_id=edge_id)

    # --- Positions ---

    async def batch_update_positions(self, workspace_id: int, positions: list[dict]) -> int:
        workspace = await self.workspace_repo.get_by_id(workspace_id)
        updated = await self.node_repo.batch_update_positions(
            workspace_id,
            positions,
            company_id=workspace.company_id,
        )
        await self.db.commit()
        return updated

    async def batch_update_company_positions(self, company_id: int, positions: list[dict]) -> int:
        updated = await self.node_repo.batch_update_company_positions(company_id, positions)
        await self.db.commit()
        return updated

    async def reset_positions(self, workspace_id: int) -> None:
        workspace = await self.workspace_repo.get_by_id(workspace_id)
        await self.node_repo.reset_positions(workspace_id, company_id=workspace.company_id)
        await self.db.commit()

    # --- Versions ---

    async def get_node_versions(self, node_id: int, limit: int = 20) -> list[KnowledgeNodeVersionResponse]:
        await self.node_repo.get_by_id(node_id)
        versions = await self.version_repo.get_versions(node_id, limit)
        return [KnowledgeNodeVersionResponse.model_validate(v) for v in versions]

    # --- Private ---

    async def _validate_edge_scope(self, source: KnowledgeNode, target: KnowledgeNode) -> None:
        if source.workspace_id and target.workspace_id:
            if source.workspace_id != target.workspace_id:
                raise ForbiddenException("Cannot link nodes from different workspaces")
            return
        if source.company_id and target.company_id:
            if source.company_id != target.company_id:
                raise ForbiddenException("Cannot link nodes from different companies")
            return
        # Cross-scope: one company, one workspace
        company_id = source.company_id or target.company_id
        ws_id = source.workspace_id or target.workspace_id
        if ws_id and company_id:
            workspace = await self.workspace_repo.get_by_id(ws_id)
            if workspace.company_id != company_id:
                raise ForbiddenException("Workspace does not belong to this company")

    @staticmethod
    def _resolve_scope(workspace_id: int | None, company_id: int | None) -> tuple[ScopeType, dict]:
        if workspace_id and not company_id:
            return ScopeType.WORKSPACE, {"workspace_id": workspace_id}
        if company_id and not workspace_id:
            return ScopeType.COMPANY, {"company_id": company_id}
        msg = "Exactly one of workspace_id or company_id must be provided"
        raise ValueError(msg)
