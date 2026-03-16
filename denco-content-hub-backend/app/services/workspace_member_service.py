from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.dependencies import _make_synthetic_viewer
from app.exceptions import ConflictException, ForbiddenException, NotFoundException
from app.models.workspace import WorkspaceRole
from app.repositories.user_repository import UserRepository
from app.repositories.workspace_member_repository import WorkspaceMemberRepository
from app.repositories.workspace_repository import WorkspaceRepository
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.workspace import (
    AddMemberRequest,
    UpdateMemberRoleRequest,
    WorkspaceMemberResponse,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.user import User
    from app.models.workspace import WorkspaceMember

logger = structlog.get_logger()

MANAGE_ROLES = (WorkspaceRole.OWNER, WorkspaceRole.ADMIN)


class WorkspaceMemberService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.workspace_repo = WorkspaceRepository(db)
        self.member_repo = WorkspaceMemberRepository(db)
        self.user_repo = UserRepository(db)

    async def add_member(self, actor: User, workspace_id: int, data: AddMemberRequest) -> WorkspaceMemberResponse:
        await self._require_manage_permission(actor.id, workspace_id)

        target_user = await self.user_repo.get_by_email(data.email)
        if not target_user:
            raise NotFoundException("User not found")

        existing = await self.member_repo.get_membership(target_user.id, workspace_id)
        if existing:
            raise ConflictException("User is already a member")

        member = await self.member_repo.add_member(user_id=target_user.id, workspace_id=workspace_id, role=data.role)
        await self.db.commit()

        logger.info(
            "Member added",
            workspace_id=workspace_id,
            user_id=target_user.id,
            role=data.role,
            actor_id=actor.id,
        )
        return self._to_response(member, target_user)

    async def update_member_role(
        self,
        actor: User,
        workspace_id: int,
        member_id: int,
        data: UpdateMemberRoleRequest,
    ) -> WorkspaceMemberResponse:
        actor_member = await self._require_manage_permission(actor.id, workspace_id)
        target_member = await self.member_repo.get_by_id(member_id)

        if target_member.workspace_id != workspace_id:
            raise NotFoundException("Member not found")

        if target_member.role == WorkspaceRole.OWNER:
            raise ForbiddenException("Cannot change owner role")

        if target_member.role == WorkspaceRole.ADMIN and actor_member.role != WorkspaceRole.OWNER:
            raise ForbiddenException("Only owner can modify admin members")

        if data.role == WorkspaceRole.ADMIN and actor_member.role != WorkspaceRole.OWNER:
            raise ForbiddenException("Only owner can assign admin role")

        target_member.role = data.role
        await self.db.flush()
        await self.db.refresh(target_member)
        await self.db.commit()

        target_user = await self.user_repo.get_by_id_or_none(target_member.user_id)
        logger.info(
            "Member role updated",
            workspace_id=workspace_id,
            member_id=member_id,
            new_role=data.role,
        )
        return self._to_response(target_member, target_user)  # type: ignore[arg-type]

    async def remove_member(self, actor: User, workspace_id: int, member_id: int) -> None:
        actor_member = await self._require_manage_permission(actor.id, workspace_id)
        target_member = await self.member_repo.get_by_id(member_id)

        if target_member.workspace_id != workspace_id:
            raise NotFoundException("Member not found")

        if target_member.role == WorkspaceRole.OWNER:
            raise ForbiddenException("Cannot remove workspace owner")

        if target_member.role == WorkspaceRole.ADMIN and actor_member.role != WorkspaceRole.OWNER:
            raise ForbiddenException("Only owner can remove admin members")

        await self.member_repo.remove_member(target_member)
        await self.db.commit()
        logger.info("Member removed", workspace_id=workspace_id, member_id=member_id)

    async def leave_workspace(self, user: User, workspace_id: int) -> None:
        member = await self.member_repo.get_membership(user.id, workspace_id)
        if not member:
            if user.is_platform_owner:
                raise ForbiddenException("Platform owner has no membership to leave")
            raise NotFoundException("Workspace not found")

        if member.role == WorkspaceRole.OWNER:
            raise ForbiddenException("Owner cannot leave workspace. Transfer ownership first.")

        await self.member_repo.remove_member(member)
        await self.db.commit()
        logger.info("Member left workspace", workspace_id=workspace_id, user_id=user.id)

    async def list_members(
        self, user: User, workspace_id: int, params: PaginationParams
    ) -> PaginatedResponse[WorkspaceMemberResponse]:
        member = await self.member_repo.get_membership(user.id, workspace_id)
        if not member:
            if user.is_platform_owner:
                member = _make_synthetic_viewer(user.id, workspace_id)
            else:
                raise NotFoundException("Workspace not found")

        page = await self.member_repo.list_members(workspace_id, params)

        items: list[WorkspaceMemberResponse] = []
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

    async def _require_manage_permission(self, user_id: int, workspace_id: int):
        await self.workspace_repo.get_by_id(workspace_id)
        member = await self.member_repo.get_membership(user_id, workspace_id)
        if not member or member.role not in MANAGE_ROLES:
            raise ForbiddenException("Insufficient permissions")
        return member

    @staticmethod
    def _to_response(member: WorkspaceMember, user: User) -> WorkspaceMemberResponse:
        return WorkspaceMemberResponse(
            id=member.id,
            user_id=member.user_id,
            user_name=user.name,
            user_email=user.email,
            role=member.role,
            created_at=member.created_at,
        )
