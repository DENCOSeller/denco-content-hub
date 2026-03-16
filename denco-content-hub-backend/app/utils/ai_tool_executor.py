"""Execute READ tools for AI assistant — DB queries with scope isolation."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

import structlog

from app.models.company_member import CompanyMember
from app.models.knowledge import KnowledgeNode, NodeType
from app.models.workspace import WorkspaceMember
from app.repositories.knowledge_edge_repository import KnowledgeEdgeRepository
from app.repositories.knowledge_node_repository import KnowledgeNodeRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()

MAX_RESULT_LEN = 2000


class ReadToolExecutor:
    """Executes READ tools with scope isolation."""

    def __init__(self, db: AsyncSession, user_id: int, page_context: dict | None = None) -> None:
        self.db = db
        self.user_id = user_id
        self.page_context = page_context or {}
        self._node_repo = KnowledgeNodeRepository(db)
        self._edge_repo = KnowledgeEdgeRepository(db)

    async def execute(self, tool_name: str, tool_input: dict) -> dict:
        """Execute a READ tool and return result dict."""
        match tool_name:
            case "search_knowledge_nodes":
                result = await self._search_nodes(tool_input)
            case "get_node_with_edges":
                result = await self._get_node_with_edges(tool_input)
            case "get_workspace_overview":
                result = await self._get_workspace_overview(tool_input)
            case "search_across_workspaces":
                result = await self._search_across_workspaces(tool_input)
            case _:
                result = {"error": f"Unknown tool: {tool_name}"}

        logger.info("read_tool_executed", tool=tool_name, result_keys=len(result))
        return result

    async def execute_json(self, tool_name: str, tool_input: dict) -> str:
        """Execute and return compact JSON string (max 2000 chars)."""
        result = await self.execute(tool_name, tool_input)
        text = json.dumps(result, ensure_ascii=False, default=str)
        if len(text) > MAX_RESULT_LEN:
            text = text[: MAX_RESULT_LEN - 20] + '..."truncated":true}'
        return text

    # ------------------------------------------------------------------
    # Tool implementations
    # ------------------------------------------------------------------

    async def _search_nodes(self, inp: dict) -> dict:
        workspace_ids, company_ids = await self._get_allowed_scopes()
        node_type = NodeType(inp["node_type"]) if inp.get("node_type") else None
        workspace_id = inp.get("workspace_id") or self.page_context.get("workspace_id")
        company_id = inp.get("company_id") or self.page_context.get("company_id")

        if workspace_id and workspace_id not in workspace_ids:
            return {"error": "Access denied to this workspace"}
        if company_id and company_id not in company_ids:
            return {"error": "Access denied to this company"}

        nodes = await self._node_repo.search_nodes(
            search=inp.get("query"),
            node_type=node_type,
            workspace_ids=workspace_ids,
            company_ids=company_ids,
            workspace_id=workspace_id,
            company_id=company_id,
            limit=inp.get("limit", 10),
        )
        logger.info("search_knowledge_nodes", user_id=self.user_id, count=len(nodes))
        return {"nodes": [_node_preview(n) for n in nodes]}

    async def _get_node_with_edges(self, inp: dict) -> dict:
        node_id: int = inp["node_id"]
        node = await self._node_repo.get_by_id(node_id)
        if not node:
            return {"error": "Node not found"}

        workspace_ids, company_ids = await self._get_allowed_scopes()
        if node.workspace_id and node.workspace_id not in workspace_ids:
            return {"error": "Access denied"}
        if node.company_id and node.company_id not in company_ids:
            return {"error": "Access denied"}

        edges = await self._edge_repo.get_edges_for_node(node_id)
        logger.info("get_node_with_edges", node_id=node_id, edges=len(edges))
        return {
            "id": node.id,
            "title": node.title,
            "node_type": str(node.node_type),
            "content_text": node.content_text or "",
            "edges": edges,
        }

    async def _get_workspace_overview(self, inp: dict) -> dict:
        workspace_ids, company_ids = await self._get_allowed_scopes()
        workspace_id = inp.get("workspace_id") or self.page_context.get("workspace_id")
        if not workspace_id:
            return {"error": "workspace_id required"}
        if workspace_id not in workspace_ids:
            return {"error": "Access denied to this workspace"}

        from app.repositories.workspace_repository import WorkspaceRepository

        ws_repo = WorkspaceRepository(self.db)
        workspace = await ws_repo.get_by_id(workspace_id)
        company_id = workspace.company_id if workspace.company_id in company_ids else None
        overview = await self._node_repo.get_workspace_overview(workspace_id, company_id=company_id)
        logger.info("get_workspace_overview", workspace_id=workspace_id, total=overview["total_nodes"])
        return overview

    async def _search_across_workspaces(self, inp: dict) -> dict:
        workspace_ids, _ = await self._get_allowed_scopes()
        node_type = NodeType(inp["node_type"]) if inp.get("node_type") else None

        results = await self._node_repo.search_across_workspaces(
            search=inp["query"],
            workspace_ids=workspace_ids,
            node_type=node_type,
            limit=inp.get("limit", 10),
        )
        logger.info("search_across_workspaces", user_id=self.user_id, count=len(results))
        return {
            "nodes": [
                {
                    **_node_preview(node),
                    "workspace_name": ws_name,
                }
                for node, ws_name in results
            ],
        }

    # ------------------------------------------------------------------
    # Scope isolation
    # ------------------------------------------------------------------

    async def _get_allowed_scopes(self) -> tuple[list[int], list[int]]:
        """Return (workspace_ids, company_ids) the user has access to."""
        from sqlalchemy import select

        ws_result = await self.db.execute(
            select(WorkspaceMember.workspace_id).where(WorkspaceMember.user_id == self.user_id)
        )
        workspace_ids = list(ws_result.scalars().all())

        cm_result = await self.db.execute(select(CompanyMember.company_id).where(CompanyMember.user_id == self.user_id))
        company_ids = list(cm_result.scalars().all())

        return workspace_ids, company_ids


def _node_preview(node: KnowledgeNode) -> dict[str, Any]:
    """Compact node representation for tool results."""
    return {
        "id": node.id,
        "title": node.title,
        "node_type": str(node.node_type),
        "content_preview": (node.content_text or "")[:200],
        "workspace_id": node.workspace_id,
        "company_id": node.company_id,
    }
