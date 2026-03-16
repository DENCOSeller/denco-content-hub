from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.exceptions import ConflictException, ForbiddenException, NotFoundException
from app.models.company_member import CompanyRole
from app.repositories.company_member_repository import CompanyMemberRepository
from app.repositories.user_repository import UserRepository
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.knowledge import (
    CompanyMemberCreate,
    CompanyMemberResponse,
    CompanyMemberUpdate,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.company_member import CompanyMember
    from app.models.user import User

logger = structlog.get_logger()


class CompanyMemberService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.member_repo = CompanyMemberRepository(db)
        self.user_repo = UserRepository(db)

    async def list_members(self, company_id: int, params: PaginationParams) -> PaginatedResponse[CompanyMemberResponse]:
        page = await self.member_repo.list_members(company_id, params)

        items: list[CompanyMemberResponse] = []
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
        self, actor_member: CompanyMember, company_id: int, data: CompanyMemberCreate
    ) -> CompanyMemberResponse:
        target_user = await self.user_repo.get_by_id_or_none(data.user_id)
        if not target_user:
            raise NotFoundException("User not found")

        existing = await self.member_repo.get_membership(company_id, data.user_id)
        if existing:
            raise ConflictException("User is already a company member")

        member = await self.member_repo.add_member(company_id=company_id, user_id=data.user_id, role=data.role)
        await self.db.commit()

        logger.info(
            "Company member added",
            company_id=company_id,
            user_id=data.user_id,
            role=data.role,
            actor_id=actor_member.user_id,
        )
        return self._to_response(member, target_user)

    async def update_member_role(
        self,
        actor_member: CompanyMember,
        company_id: int,
        member_id: int,
        data: CompanyMemberUpdate,
    ) -> CompanyMemberResponse:
        target_member = await self.member_repo.get_by_id(member_id)

        if target_member.company_id != company_id:
            raise NotFoundException("Member not found")

        if target_member.role == CompanyRole.OWNER:
            raise ForbiddenException("Cannot change owner role")

        if target_member.role == CompanyRole.ADMIN and actor_member.role != CompanyRole.OWNER:
            raise ForbiddenException("Only owner can modify admin members")

        if data.role == CompanyRole.ADMIN and actor_member.role != CompanyRole.OWNER:
            raise ForbiddenException("Only owner can assign admin role")

        target_member = await self.member_repo.update_role(target_member, data.role)
        await self.db.commit()

        target_user = await self.user_repo.get_by_id_or_none(target_member.user_id)
        logger.info(
            "Company member role updated",
            company_id=company_id,
            member_id=member_id,
            new_role=data.role,
            actor_id=actor_member.user_id,
        )
        return self._to_response(target_member, target_user)  # type: ignore[arg-type]

    async def remove_member(self, actor_member: CompanyMember, company_id: int, member_id: int) -> None:
        target_member = await self.member_repo.get_by_id(member_id)

        if target_member.company_id != company_id:
            raise NotFoundException("Member not found")

        if target_member.role == CompanyRole.OWNER:
            raise ForbiddenException("Cannot remove company owner")

        if target_member.role == CompanyRole.ADMIN and actor_member.role != CompanyRole.OWNER:
            raise ForbiddenException("Only owner can remove admin members")

        await self.member_repo.remove_member(target_member)
        await self.db.commit()
        logger.info(
            "Company member removed",
            company_id=company_id,
            member_id=member_id,
            actor_id=actor_member.user_id,
        )

    @staticmethod
    def _to_response(member: CompanyMember, user: User) -> CompanyMemberResponse:
        return CompanyMemberResponse(
            id=member.id,
            company_id=member.company_id,
            user_id=member.user_id,
            user_name=user.name,
            user_email=user.email,
            role=member.role,
            created_at=member.created_at,
        )
