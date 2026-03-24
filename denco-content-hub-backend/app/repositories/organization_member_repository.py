from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from app.models.organization_member import OrganizationMember, OrganizationRole
from app.models.user import User
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams


class OrganizationMemberRepository(BaseRepository[OrganizationMember]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(OrganizationMember, db)

    async def get_membership(self, organization_id: int, user_id: int) -> OrganizationMember | None:
        query = select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def add_member(self, organization_id: int, user_id: int, role: OrganizationRole) -> OrganizationMember:
        return await self.create(organization_id=organization_id, user_id=user_id, role=role)

    async def update_role(self, member: OrganizationMember, role: OrganizationRole) -> OrganizationMember:
        member.role = role
        await self.db.flush()
        await self.db.refresh(member)
        return member

    async def remove_member(self, member: OrganizationMember) -> None:
        await self.db.delete(member)
        await self.db.flush()

    async def list_members(self, organization_id: int, params: PaginationParams) -> PaginatedResponse[OrganizationMember]:
        query = (
            select(OrganizationMember)
            .join(User, User.id == OrganizationMember.user_id)
            .where(OrganizationMember.organization_id == organization_id, User.deleted_at.is_(None))
            .order_by(OrganizationMember.created_at)
        )
        return await self.paginate(query, params)

    async def is_admin_or_owner(self, organization_id: int, user_id: int) -> bool:
        member = await self.get_membership(organization_id, user_id)
        if not member:
            return False
        return member.role in (OrganizationRole.OWNER, OrganizationRole.ADMIN)
