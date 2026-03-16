from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import or_, select

from app.models.knowledge import KgEdgeTypeDef
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.knowledge import KgEdgeTypeDefCreate


class KgEdgeTypeRepository(BaseRepository[KgEdgeTypeDef]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(KgEdgeTypeDef, db)

    async def get_all(self, company_id: int | None = None) -> list[KgEdgeTypeDef]:
        """Системные типы + custom для company."""
        query = select(KgEdgeTypeDef).where(KgEdgeTypeDef.is_active.is_(True))
        if company_id is not None:
            query = query.where(
                or_(
                    KgEdgeTypeDef.is_system.is_(True),
                    KgEdgeTypeDef.company_id == company_id,
                )
            )
        else:
            query = query.where(KgEdgeTypeDef.is_system.is_(True))
        query = query.order_by(KgEdgeTypeDef.id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_slug(
        self,
        slug: str,
        company_id: int | None = None,
    ) -> KgEdgeTypeDef | None:
        query = select(KgEdgeTypeDef).where(KgEdgeTypeDef.slug == slug)
        if company_id is not None:
            query = query.where(
                or_(
                    KgEdgeTypeDef.is_system.is_(True),
                    KgEdgeTypeDef.company_id == company_id,
                )
            )
        else:
            query = query.where(KgEdgeTypeDef.is_system.is_(True))
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_custom(
        self,
        data: KgEdgeTypeDefCreate,
        company_id: int,
    ) -> KgEdgeTypeDef:
        return await self.create(
            slug=data.slug,
            label=data.label,
            description=data.description,
            is_directed=data.is_directed,
            is_system=False,
            company_id=company_id,
        )

    async def deactivate(self, type_id: int) -> KgEdgeTypeDef:
        """Деактивировать только не-системный тип."""
        instance = await self.get_by_id(type_id)
        if instance.is_system:
            msg = "Cannot deactivate system edge type"
            raise ValueError(msg)
        instance.is_active = False
        await self.db.flush()
        await self.db.refresh(instance)
        return instance
