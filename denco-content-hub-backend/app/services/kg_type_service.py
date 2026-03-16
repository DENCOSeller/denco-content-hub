from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.exceptions import BadRequestException, ConflictException, NotFoundException
from app.repositories.kg_edge_type_repository import KgEdgeTypeRepository
from app.repositories.kg_node_type_repository import KgNodeTypeRepository
from app.schemas.knowledge import (
    KgEdgeTypeDefResponse,
    KgNodeTypeDefResponse,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.knowledge import KgEdgeTypeDefCreate, KgNodeTypeDefCreate

logger = structlog.get_logger()


class KgTypeService:
    """CRUD для определений типов узлов и связей."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.node_type_repo = KgNodeTypeRepository(db)
        self.edge_type_repo = KgEdgeTypeRepository(db)

    # --- Node types ---

    async def get_node_types(self, company_id: int) -> list[KgNodeTypeDefResponse]:
        """Системные (company_id=NULL) + custom для этой компании. Только is_active=True."""
        items = await self.node_type_repo.get_all(company_id)
        return [KgNodeTypeDefResponse.model_validate(i) for i in items]

    async def create_node_type(
        self,
        company_id: int,
        data: KgNodeTypeDefCreate,
    ) -> KgNodeTypeDefResponse:
        """Создаёт custom тип для компании. Валидация: slug уникален в рамках company."""
        existing = await self.node_type_repo.get_by_slug(data.slug, company_id)
        if existing:
            raise ConflictException(f"Node type with slug '{data.slug}' already exists")
        node_type = await self.node_type_repo.create_custom(data, company_id)
        await self.db.commit()
        logger.info("KG node type created", type_id=node_type.id, slug=data.slug, company_id=company_id)
        return KgNodeTypeDefResponse.model_validate(node_type)

    async def deactivate_node_type(self, type_id: int, company_id: int) -> None:
        """Деактивирует тип. Системные — нельзя (ошибка 400). Проверяет принадлежность компании."""
        instance = await self.node_type_repo.get_by_id(type_id)
        if instance.company_id != company_id:
            raise NotFoundException("KgNodeTypeDef not found")
        try:
            await self.node_type_repo.deactivate(type_id)
        except ValueError as e:
            raise BadRequestException(str(e)) from e
        await self.db.commit()
        logger.info("KG node type deactivated", type_id=type_id, company_id=company_id)

    # --- Edge types ---

    async def get_edge_types(self, company_id: int) -> list[KgEdgeTypeDefResponse]:
        """Системные + custom для компании. Только is_active=True."""
        items = await self.edge_type_repo.get_all(company_id)
        return [KgEdgeTypeDefResponse.model_validate(i) for i in items]

    async def create_edge_type(
        self,
        company_id: int,
        data: KgEdgeTypeDefCreate,
    ) -> KgEdgeTypeDefResponse:
        """Создаёт custom тип связи. Валидация: slug уникален в рамках company."""
        existing = await self.edge_type_repo.get_by_slug(data.slug, company_id)
        if existing:
            raise ConflictException(f"Edge type with slug '{data.slug}' already exists")
        edge_type = await self.edge_type_repo.create_custom(data, company_id)
        await self.db.commit()
        logger.info("KG edge type created", type_id=edge_type.id, slug=data.slug, company_id=company_id)
        return KgEdgeTypeDefResponse.model_validate(edge_type)

    async def deactivate_edge_type(self, type_id: int, company_id: int) -> None:
        """Деактивирует тип связи. Системные — нельзя (ошибка 400). Проверяет принадлежность компании."""
        instance = await self.edge_type_repo.get_by_id(type_id)
        if instance.company_id != company_id:
            raise NotFoundException("KgEdgeTypeDef not found")
        try:
            await self.edge_type_repo.deactivate(type_id)
        except ValueError as e:
            raise BadRequestException(str(e)) from e
        await self.db.commit()
        logger.info("KG edge type deactivated", type_id=type_id, company_id=company_id)
