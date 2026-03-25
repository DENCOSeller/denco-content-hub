from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import func, select

from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams


class UserRepository(BaseRepository[User]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(User, db)

    async def get_by_email(self, email: str) -> User | None:
        """Get active user by email. Returns None if not found."""
        query = self._base_query().where(User.email == email)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_staff_employee_id(self, staff_employee_id: int) -> User | None:
        """Get active user by staff_employee_id. Returns None if not found."""
        query = self._base_query().where(User.staff_employee_id == staff_employee_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_all_users(
        self,
        params: PaginationParams,
        search: str | None = None,
    ) -> PaginatedResponse[User]:
        query = self._base_query()
        if search:
            query = query.where(User.name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))
        query = query.order_by(User.created_at.desc())
        return await self.paginate(query, params)

    async def get_workspaces_count(self, user_id: int) -> int:
        query = select(func.count()).where(WorkspaceMember.user_id == user_id)
        result = await self.db.execute(query)
        return result.scalar_one()
