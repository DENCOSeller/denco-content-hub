from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import delete, select

from app.models.public_knowledge import KgPublicLink, KgPublicLinkNode

if TYPE_CHECKING:
    from datetime import datetime

    from sqlalchemy.ext.asyncio import AsyncSession


class PublicLinkRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(
        self,
        scope_type: str,
        scope_id: int,
        visibility_mode: str = "active",
        title: str | None = None,
        description: str | None = None,
        expires_at: datetime | None = None,
        created_by_user_id: int | None = None,
    ) -> KgPublicLink:
        link = KgPublicLink(
            scope_type=scope_type,
            scope_id=scope_id,
            visibility_mode=visibility_mode,
            title=title,
            description=description,
            expires_at=expires_at,
            created_by_user_id=created_by_user_id,
        )
        self.db.add(link)
        await self.db.flush()
        await self.db.refresh(link)
        return link

    async def get_by_id(self, link_id: int) -> KgPublicLink | None:
        query = select(KgPublicLink).where(KgPublicLink.id == link_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_token(self, token: str) -> KgPublicLink | None:
        query = select(KgPublicLink).where(KgPublicLink.token == token)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_scope(self, scope_type: str, scope_id: int) -> list[KgPublicLink]:
        query = (
            select(KgPublicLink)
            .where(
                KgPublicLink.scope_type == scope_type,
                KgPublicLink.scope_id == scope_id,
            )
            .order_by(KgPublicLink.created_at.desc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update(self, link_id: int, **kwargs: Any) -> KgPublicLink | None:
        query = select(KgPublicLink).where(KgPublicLink.id == link_id)
        result = await self.db.execute(query)
        link = result.scalar_one_or_none()
        if link is None:
            return None
        for key, value in kwargs.items():
            setattr(link, key, value)
        await self.db.flush()
        await self.db.refresh(link)
        return link

    async def delete(self, link_id: int) -> bool:
        query = select(KgPublicLink).where(KgPublicLink.id == link_id)
        result = await self.db.execute(query)
        link = result.scalar_one_or_none()
        if link is None:
            return False
        await self.db.delete(link)
        await self.db.flush()
        return True

    async def add_node(self, link_id: int, node_id: int) -> KgPublicLinkNode:
        node = KgPublicLinkNode(link_id=link_id, node_id=node_id)
        self.db.add(node)
        await self.db.flush()
        return node

    async def remove_node(self, link_id: int, node_id: int) -> bool:
        stmt = delete(KgPublicLinkNode).where(
            KgPublicLinkNode.link_id == link_id,
            KgPublicLinkNode.node_id == node_id,
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.rowcount > 0  # type: ignore[attr-defined]

    async def get_selected_node_ids(self, link_id: int) -> list[int]:
        query = select(KgPublicLinkNode.node_id).where(KgPublicLinkNode.link_id == link_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())
