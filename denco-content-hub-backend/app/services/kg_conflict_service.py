from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime
from difflib import SequenceMatcher
from typing import TYPE_CHECKING

import structlog
from sqlalchemy import select

from app.exceptions import BadRequestException, ForbiddenException
from app.models.knowledge import KnowledgeNode, ScopeType
from app.repositories.kg_conflict_repository import KgConflictRepository
from app.repositories.workspace_repository import WorkspaceRepository
from app.schemas.knowledge import KgConflictResolve, KgConflictResponse

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()

SIMILARITY_THRESHOLD = 0.85


class KgConflictService:
    """Обнаружение и разрешение конфликтов между company и workspace узлами."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.conflict_repo = KgConflictRepository(db)
        self.workspace_repo = WorkspaceRepository(db)

    async def detect_conflicts(self, workspace_id: int) -> list[KgConflictResponse]:
        """Сканирует workspace vs company узлы, создаёт новые конфликты."""
        workspace = await self.workspace_repo.get_by_id(workspace_id)
        company_id = workspace.company_id

        company_nodes = await self._load_active_nodes(
            scope_type=ScopeType.COMPANY,
            company_id=company_id,
        )
        workspace_nodes = await self._load_active_nodes(
            scope_type=ScopeType.WORKSPACE,
            workspace_id=workspace_id,
        )

        if not company_nodes or not workspace_nodes:
            return await self._get_open_conflicts_raw(workspace_id)

        # Загружаем все открытые конфликты одним запросом (fix N+1)
        existing_conflicts = await self.conflict_repo.get_open_conflicts(workspace_id)
        existing_keys: set[tuple[int, int, str]] = {
            (c.company_node_id, c.workspace_node_id, c.conflict_type) for c in existing_conflicts
        }

        # Группируем по node_type_def_id для оптимизации
        company_by_type: dict[int | None, list[KnowledgeNode]] = defaultdict(list)
        for node in company_nodes:
            company_by_type[node.node_type_def_id].append(node)

        new_conflicts: list[dict] = []

        for ws_node in workspace_nodes:
            matching_company = company_by_type.get(ws_node.node_type_def_id, [])
            for c_node in matching_company:
                conflict = self._check_pair(c_node, ws_node, existing_keys)
                if conflict:
                    new_conflicts.append(conflict)

        if new_conflicts:
            await self.conflict_repo.create_bulk(new_conflicts)
            await self.db.commit()
            logger.info(
                "KG conflicts detected",
                workspace_id=workspace_id,
                new_count=len(new_conflicts),
            )

        return await self._get_open_conflicts_raw(workspace_id)

    async def get_open_conflicts(self, workspace_id: int) -> list[KgConflictResponse]:
        """Возвращает все открытые конфликты для workspace."""
        return await self._get_open_conflicts_raw(workspace_id)

    async def resolve_conflict(
        self,
        conflict_id: int,
        user_id: int,
        resolution: KgConflictResolve,
        workspace_id: int,
    ) -> None:
        """Разрешает или отклоняет конфликт."""
        conflict = await self.conflict_repo.get_by_id(conflict_id)

        # IDOR-защита: проверяем принадлежность конфликта к workspace
        ws_node = conflict.workspace_node
        if ws_node is None or ws_node.workspace_id != workspace_id:
            raise ForbiddenException("Conflict does not belong to this workspace")

        if conflict.status != "open":
            raise BadRequestException("Conflict is already resolved")

        await self.conflict_repo.update_status(
            conflict_id=conflict_id,
            status=resolution.status,
            resolved_by_user_id=user_id,
            resolved_at=datetime.now(UTC),
        )
        await self.db.commit()
        logger.info(
            "KG conflict resolved",
            conflict_id=conflict_id,
            status=resolution.status,
            user_id=user_id,
        )

    # --- Private ---

    async def _load_active_nodes(
        self,
        *,
        scope_type: ScopeType,
        company_id: int | None = None,
        workspace_id: int | None = None,
    ) -> list[KnowledgeNode]:
        """Загружает active узлы по scope."""
        query = select(KnowledgeNode).where(
            KnowledgeNode.scope_type == scope_type,
            KnowledgeNode.deleted_at.is_(None),
            KnowledgeNode.status == "active",
        )
        if company_id is not None:
            query = query.where(KnowledgeNode.company_id == company_id)
        if workspace_id is not None:
            query = query.where(KnowledgeNode.workspace_id == workspace_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    def _check_pair(
        self,
        company_node: KnowledgeNode,
        workspace_node: KnowledgeNode,
        existing_keys: set[tuple[int, int, str]],
    ) -> dict | None:
        """Проверяет пару на конфликт. Возвращает dict для create_bulk или None."""
        c_title = company_node.title.strip().lower()
        w_title = workspace_node.title.strip().lower()

        if c_title == w_title:
            conflict_type = "title_clash"
            description = f"Точное совпадение title: «{company_node.title}»"
        else:
            ratio = SequenceMatcher(None, c_title, w_title).ratio()
            if ratio > SIMILARITY_THRESHOLD:
                conflict_type = "semantic_overlap"
                description = (
                    f"Похожие title (similarity={ratio:.2f}): «{company_node.title}» ↔ «{workspace_node.title}»"
                )
            else:
                return None

        # Проверяем дубликат по set ключей (вместо запроса в БД)
        key = (company_node.id, workspace_node.id, conflict_type)
        if key in existing_keys:
            return None

        return {
            "company_node_id": company_node.id,
            "workspace_node_id": workspace_node.id,
            "conflict_type": conflict_type,
            "description": description,
        }

    async def _get_open_conflicts_raw(
        self,
        workspace_id: int,
    ) -> list[KgConflictResponse]:
        conflicts = await self.conflict_repo.get_open_conflicts(workspace_id)
        return [KgConflictResponse.model_validate(c) for c in conflicts]
