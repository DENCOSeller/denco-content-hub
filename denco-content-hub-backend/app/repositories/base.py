from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Select, func, select

from app.exceptions import NotFoundException
from app.models.base import Base, SoftDeleteMixin
from app.schemas.common import PaginatedResponse, PaginationParams

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class BaseRepository[T: Base]:
    """Generic repository with flush-based CRUD.

    Repositories use flush() instead of commit().
    Services call commit() after all operations.
    """

    def __init__(self, model: type[T], db: AsyncSession) -> None:
        self.model = model
        self.db = db

    def _base_query(self) -> Select[tuple[T]]:
        """Base query that filters out soft-deleted records."""
        query = select(self.model)
        if issubclass(self.model, SoftDeleteMixin):
            query = query.where(self.model.deleted_at.is_(None))  # type: ignore[attr-defined]
        return query

    async def get_by_id(self, entity_id: int) -> T:
        """Get entity by ID. Raises NotFoundException if not found."""
        query = self._base_query().where(self.model.id == entity_id)  # type: ignore[attr-defined]
        result = await self.db.execute(query)
        instance = result.scalar_one_or_none()
        if instance is None:
            raise NotFoundException(f"{self.model.__name__} not found")
        return instance

    async def get_by_id_or_none(self, entity_id: int) -> T | None:
        """Get entity by ID or return None."""
        query = self._base_query().where(self.model.id == entity_id)  # type: ignore[attr-defined]
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_ids(self, ids: list[int]) -> list[T]:
        """Get entities by list of IDs. Returns only found entities."""
        if not ids:
            return []
        query = self._base_query().where(self.model.id.in_(ids))  # type: ignore[attr-defined]
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create(self, **kwargs: Any) -> T:
        """Create a new entity. Uses flush(), not commit()."""
        instance = self.model(**kwargs)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, entity_id: int, **kwargs: Any) -> T:
        """Update an entity by ID. Uses flush(), not commit()."""
        instance = await self.get_by_id(entity_id)
        for key, value in kwargs.items():
            setattr(instance, key, value)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def soft_delete(self, entity_id: int) -> T:
        """Soft delete an entity. Uses flush(), not commit()."""
        if not issubclass(self.model, SoftDeleteMixin):
            msg = f"{self.model.__name__} does not support soft delete"
            raise TypeError(msg)
        instance = await self.get_by_id(entity_id)
        instance.deleted_at = datetime.now(UTC)  # type: ignore[attr-defined]
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def paginate(
        self,
        query: Select[tuple[T]],
        params: PaginationParams,
    ) -> PaginatedResponse[T]:
        """Apply pagination to a query and return PaginatedResponse."""
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        paginated = query.offset(params.offset).limit(params.size)
        result = await self.db.execute(paginated)
        items = list(result.scalars().all())

        pages = (total + params.size - 1) // params.size if total > 0 else 0

        return PaginatedResponse(
            items=items,
            total=total,
            page=params.page,
            size=params.size,
            pages=pages,
        )
