from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from app.models.company_member import CompanyMember, CompanyRole
from app.models.user import User
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams


class CompanyMemberRepository(BaseRepository[CompanyMember]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(CompanyMember, db)

    async def get_membership(self, company_id: int, user_id: int) -> CompanyMember | None:
        query = select(CompanyMember).where(
            CompanyMember.company_id == company_id,
            CompanyMember.user_id == user_id,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def add_member(self, company_id: int, user_id: int, role: CompanyRole) -> CompanyMember:
        return await self.create(company_id=company_id, user_id=user_id, role=role)

    async def update_role(self, member: CompanyMember, role: CompanyRole) -> CompanyMember:
        member.role = role
        await self.db.flush()
        await self.db.refresh(member)
        return member

    async def remove_member(self, member: CompanyMember) -> None:
        await self.db.delete(member)
        await self.db.flush()

    async def list_members(self, company_id: int, params: PaginationParams) -> PaginatedResponse[CompanyMember]:
        query = (
            select(CompanyMember)
            .join(User, User.id == CompanyMember.user_id)
            .where(CompanyMember.company_id == company_id, User.deleted_at.is_(None))
            .order_by(CompanyMember.created_at)
        )
        return await self.paginate(query, params)

    async def is_admin_or_owner(self, company_id: int, user_id: int) -> bool:
        member = await self.get_membership(company_id, user_id)
        if not member:
            return False
        return member.role in (CompanyRole.OWNER, CompanyRole.ADMIN)
