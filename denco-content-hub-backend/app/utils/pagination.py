from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Select, func, select

from app.schemas.common import PaginatedResponse, PaginationParams

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


async def paginate[T](
    query: Select[tuple[T]],
    db: AsyncSession,
    params: PaginationParams,
) -> PaginatedResponse[T]:
    """Apply pagination to a query and return PaginatedResponse.

    Standalone helper for use outside BaseRepository.
    """
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    paginated = query.offset(params.offset).limit(params.size)
    result = await db.execute(paginated)
    items = list(result.scalars().all())

    pages = (total + params.size - 1) // params.size if total > 0 else 0

    return PaginatedResponse(
        items=items,
        total=total,
        page=params.page,
        size=params.size,
        pages=pages,
    )
