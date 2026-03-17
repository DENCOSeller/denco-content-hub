from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

import structlog

from app.exceptions import NotFoundException
from app.repositories.knowledge_edge_repository import KnowledgeEdgeRepository
from app.repositories.knowledge_node_repository import KnowledgeNodeRepository
from app.repositories.public_link_repository import PublicLinkRepository
from app.schemas.public_knowledge import (
    KgPublicLinkCreate,
    KgPublicLinkResponse,
    KgPublicLinkUpdate,
    PublicKnowledgeEdgeResponse,
    PublicKnowledgeGraphResponse,
    PublicKnowledgeNodeResponse,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


class PublicKnowledgeService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.link_repo = PublicLinkRepository(db)
        self.node_repo = KnowledgeNodeRepository(db)
        self.edge_repo = KnowledgeEdgeRepository(db)

    async def get_public_graph(self, token: str) -> PublicKnowledgeGraphResponse:
        link = await self.link_repo.get_by_token(token)
        if link is None or not link.is_active:
            raise NotFoundException("Public graph not found")

        if link.expires_at is not None:
            now = datetime.now(tz=UTC)
            expires = link.expires_at
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=UTC)
            if expires < now:
                raise NotFoundException("Public graph link has expired")

        if link.scope_type == "workspace":
            nodes = await self.node_repo.get_by_workspace(link.scope_id)
        else:
            nodes = await self.node_repo.get_by_company(link.scope_id)

        if link.visibility_mode == "all":
            visible_nodes = nodes
        elif link.visibility_mode == "active":
            visible_nodes = [n for n in nodes if n.status == "active"]
        else:  # selected
            selected_ids = set(await self.link_repo.get_selected_node_ids(link.id))
            visible_nodes = [n for n in nodes if n.id in selected_ids]

        visible_ids = {n.id for n in visible_nodes}
        all_edges = await self.edge_repo.get_for_node_ids(list(visible_ids))
        visible_edges = [e for e in all_edges if e.source_node_id in visible_ids and e.target_node_id in visible_ids]

        logger.info("Public graph served", token=token, nodes=len(visible_nodes), edges=len(visible_edges))

        return PublicKnowledgeGraphResponse(
            nodes=[PublicKnowledgeNodeResponse.model_validate(n) for n in visible_nodes],
            edges=[PublicKnowledgeEdgeResponse.model_validate(e) for e in visible_edges],
            title=link.title,
            description=link.description,
        )

    async def create_public_link(self, data: KgPublicLinkCreate, user_id: int) -> KgPublicLinkResponse:
        link = await self.link_repo.create(
            scope_type=data.scope_type,
            scope_id=data.scope_id,
            visibility_mode=data.visibility_mode,
            title=data.title,
            description=data.description,
            expires_at=data.expires_at,
            created_by_user_id=user_id,
        )
        await self.db.commit()
        await self.db.refresh(link)
        logger.info("Public link created", link_id=link.id, scope_type=data.scope_type, scope_id=data.scope_id)
        return KgPublicLinkResponse.model_validate(link)

    async def update_public_link(
        self, link_id: int, data: KgPublicLinkUpdate, user_id: int, scope_type: str, scope_id: int
    ) -> KgPublicLinkResponse:
        existing = await self.link_repo.get_by_id(link_id)
        if existing is None or existing.scope_type != scope_type or existing.scope_id != scope_id:
            raise NotFoundException("Public link not found")
        update_data = data.model_dump(exclude_unset=True)
        link = await self.link_repo.update(link_id, **update_data)
        if link is None:
            raise NotFoundException("Public link not found")
        await self.db.commit()
        await self.db.refresh(link)
        logger.info("Public link updated", link_id=link_id, updated_by=user_id)
        return KgPublicLinkResponse.model_validate(link)

    async def delete_public_link(self, link_id: int, scope_type: str, scope_id: int) -> None:
        existing = await self.link_repo.get_by_id(link_id)
        if existing is None or existing.scope_type != scope_type or existing.scope_id != scope_id:
            raise NotFoundException("Public link not found")
        await self.link_repo.delete(link_id)
        await self.db.commit()
        logger.info("Public link deleted", link_id=link_id)

    async def list_public_links(self, scope_type: str, scope_id: int) -> list[KgPublicLinkResponse]:
        links = await self.link_repo.get_by_scope(scope_type, scope_id)
        return [KgPublicLinkResponse.model_validate(link) for link in links]

    async def add_node_to_link(self, link_id: int, node_id: int, scope_type: str, scope_id: int) -> None:
        link = await self.link_repo.get_by_id(link_id)
        if link is None or link.scope_type != scope_type or link.scope_id != scope_id:
            raise NotFoundException("Public link not found")
        await self.link_repo.add_node(link_id, node_id)
        await self.db.commit()
        logger.info("Node added to public link", link_id=link_id, node_id=node_id)

    async def remove_node_from_link(self, link_id: int, node_id: int, scope_type: str, scope_id: int) -> None:
        link = await self.link_repo.get_by_id(link_id)
        if link is None or link.scope_type != scope_type or link.scope_id != scope_id:
            raise NotFoundException("Public link not found")
        removed = await self.link_repo.remove_node(link_id, node_id)
        if not removed:
            raise NotFoundException("Node not found in public link")
        await self.db.commit()
        logger.info("Node removed from public link", link_id=link_id, node_id=node_id)
