from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.exceptions import ConflictException, ForbiddenException, NotFoundException
from app.models.organization_member import OrganizationRole
from app.repositories.organization_member_repository import OrganizationMemberRepository
from app.repositories.user_repository import UserRepository
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.knowledge import (
    OrganizationMemberCreate,
    OrganizationMemberResponse,
    OrganizationMemberUpdate,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.organization_member import OrganizationMember
    from app.models.user import User

logger = structlog.get_logger()


class OrganizationMemberService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.member_repo = OrganizationMemberRepository(db)
        self.user_repo = UserRepository(db)

    async def list_members(self, organization_id: int, params: PaginationParams) -> PaginatedResponse[OrganizationMemberResponse]:
        page = await self.member_repo.list_members(organization_id, params)

        items: list[OrganizationMemberResponse] = []
        for m in page.items:
            u = await self.user_repo.get_by_id_or_none(m.user_id)
            if u:
                items.append(self._to_response(m, u))

        return PaginatedResponse(
            items=items,
            total=page.total,
            page=page.page,
            size=page.size,
            pages=page.pages,
        )

    async def add_member(
        self, actor_member: OrganizationMember, organization_id: int, data: OrganizationMemberCreate
    ) -> OrganizationMemberResponse:
        target_user = await self.user_repo.get_by_id_or_none(data.user_id)
        if not target_user:
            raise NotFoundException("User not found")

        existing = await self.member_repo.get_membership(organization_id, data.user_id)
        if existing:
            raise ConflictException("User is already an organization member")

        member = await self.member_repo.add_member(organization_id=organization_id, user_id=data.user_id, role=data.role)
        await self.db.commit()

        logger.info(
            "Organization member added",
            organization_id=organization_id,
            user_id=data.user_id,
            role=data.role,
            actor_id=actor_member.user_id,
        )
        return self._to_response(member, target_user)

    async def update_member_role(
        self,
        actor_member: OrganizationMember,
        organization_id: int,
        member_id: int,
        data: OrganizationMemberUpdate,
    ) -> OrganizationMemberResponse:
        target_member = await self.member_repo.get_by_id(member_id)

        if target_member.organization_id != organization_id:
            raise NotFoundException("Member not found")

        if target_member.role == OrganizationRole.OWNER:
            raise ForbiddenException("Cannot change owner role")

        if target_member.role == OrganizationRole.ADMIN and actor_member.role != OrganizationRole.OWNER:
            raise ForbiddenException("Only owner can modify admin members")

        if data.role == OrganizationRole.ADMIN and actor_member.role != OrganizationRole.OWNER:
            raise ForbiddenException("Only owner can assign admin role")

        target_member = await self.member_repo.update_role(target_member, data.role)
        await self.db.commit()

        target_user = await self.user_repo.get_by_id_or_none(target_member.user_id)
        logger.info(
            "Organization member role updated",
            organization_id=organization_id,
            member_id=member_id,
            new_role=data.role,
            actor_id=actor_member.user_id,
        )
        return self._to_response(target_member, target_user)  # type: ignore[arg-type]

    async def remove_member(self, actor_member: OrganizationMember, organization_id: int, member_id: int) -> None:
        target_member = await self.member_repo.get_by_id(member_id)

        if target_member.organization_id != organization_id:
            raise NotFoundException("Member not found")

        if target_member.role == OrganizationRole.OWNER:
            raise ForbiddenException("Cannot remove organization owner")

        if target_member.role == OrganizationRole.ADMIN and actor_member.role != OrganizationRole.OWNER:
            raise ForbiddenException("Only owner can remove admin members")

        await self.member_repo.remove_member(target_member)
        await self.db.commit()
        logger.info(
            "Organization member removed",
            organization_id=organization_id,
            member_id=member_id,
            actor_id=actor_member.user_id,
        )

    @staticmethod
    def _to_response(member: OrganizationMember, user: User) -> OrganizationMemberResponse:
        return OrganizationMemberResponse(
            id=member.id,
            organization_id=member.organization_id,
            user_id=member.user_id,
            user_name=user.name,
            user_email=user.email,
            role=member.role,
            created_at=member.created_at,
        )
