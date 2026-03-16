from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import func, or_, select

from app.models.knowledge import KgNodeTypeDef
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.knowledge import KgNodeTypeDefCreate


class KgNodeTypeRepository(BaseRepository[KgNodeTypeDef]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(KgNodeTypeDef, db)

    async def get_all(self, company_id: int | None = None) -> list[KgNodeTypeDef]:
        """Системные типы + custom для company."""
        query = select(KgNodeTypeDef).where(KgNodeTypeDef.is_active.is_(True))
        if company_id is not None:
            query = query.where(
                or_(
                    KgNodeTypeDef.is_system.is_(True),
                    KgNodeTypeDef.company_id == company_id,
                )
            )
        else:
            query = query.where(KgNodeTypeDef.is_system.is_(True))
        query = query.order_by(KgNodeTypeDef.sort_order, KgNodeTypeDef.id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_slug(
        self,
        slug: str,
        company_id: int | None = None,
    ) -> KgNodeTypeDef | None:
        query = select(KgNodeTypeDef).where(KgNodeTypeDef.slug == slug)
        if company_id is not None:
            query = query.where(
                or_(
                    KgNodeTypeDef.is_system.is_(True),
                    KgNodeTypeDef.company_id == company_id,
                )
            )
        else:
            query = query.where(KgNodeTypeDef.is_system.is_(True))
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _next_sort_order(self, company_id: int) -> int:
        """max(sort_order) + 1 среди типов компании и системных."""
        query = select(func.coalesce(func.max(KgNodeTypeDef.sort_order), 0)).where(
            or_(
                KgNodeTypeDef.is_system.is_(True),
                KgNodeTypeDef.company_id == company_id,
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one() + 1

    async def create_custom(
        self,
        data: KgNodeTypeDefCreate,
        company_id: int,
    ) -> KgNodeTypeDef:
        sort_order = await self._next_sort_order(company_id)
        return await self.create(
            slug=data.slug,
            label=data.label,
            icon=data.icon,
            color=data.color,
            gradient=data.gradient,
            is_system=False,
            company_id=company_id,
            sort_order=sort_order,
        )

    async def deactivate(self, type_id: int) -> KgNodeTypeDef:
        """Деактивировать только не-системный тип."""
        instance = await self.get_by_id(type_id)
        if instance.is_system:
            msg = "Cannot deactivate system node type"
            raise ValueError(msg)
        instance.is_active = False
        await self.db.flush()
        await self.db.refresh(instance)
        return instance
