from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.dependencies import _make_synthetic_viewer
from app.exceptions import ConflictException, ForbiddenException, NotFoundException
from app.models.workspace import WorkspaceRole
from app.repositories.company_repository import CompanyRepository
from app.repositories.invitation_repository import InvitationRepository
from app.repositories.user_repository import UserRepository
from app.repositories.workspace_member_repository import WorkspaceMemberRepository
from app.repositories.workspace_repository import WorkspaceRepository
from app.schemas.workspace import (
    TransferOwnershipRequest,
    WorkspaceCreate,
    WorkspaceResponse,
    WorkspaceUpdate,
)
from app.utils.slugify import slugify

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.user import User
    from app.models.workspace import Workspace

logger = structlog.get_logger()


class WorkspaceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.workspace_repo = WorkspaceRepository(db)
        self.member_repo = WorkspaceMemberRepository(db)
        self.company_repo = CompanyRepository(db)

    async def create_workspace(self, user: User, data: WorkspaceCreate) -> WorkspaceResponse:
        company_id = await self._resolve_company_id(user, data.company_id)
        slug = await self._generate_unique_slug(data.name)
        workspace = await self.workspace_repo.create(
            name=data.name, slug=slug, is_personal=False, company_id=company_id
        )
        member = await self.member_repo.add_member(user_id=user.id, workspace_id=workspace.id, role=WorkspaceRole.OWNER)
        await self.db.commit()

        workspace = await self.workspace_repo.get_by_id(workspace.id)
        logger.info("Workspace created", workspace_id=workspace.id, user_id=user.id)
        return self._to_response(workspace, member.role)

    async def create_personal_workspace(self, user: User, company_id: int) -> Workspace:
        slug = await self._generate_unique_slug(f"{user.name}s-workspace")
        workspace = await self.workspace_repo.create(
            name=f"{user.name}'s Workspace", slug=slug, is_personal=True, company_id=company_id
        )
        await self.member_repo.add_member(user_id=user.id, workspace_id=workspace.id, role=WorkspaceRole.OWNER)
        logger.info("Personal workspace created", workspace_id=workspace.id, user_id=user.id)
        return workspace

    async def get_user_workspaces(self, user: User) -> list[WorkspaceResponse]:
        workspaces = await self.workspace_repo.get_user_workspaces(user.id)
        result: list[WorkspaceResponse] = []
        for ws in workspaces:
            member = await self.member_repo.get_membership(user.id, ws.id)
            if member:
                result.append(self._to_response(ws, member.role))
        return result

    async def get_workspace_detail(self, user: User, workspace_id: int) -> WorkspaceResponse:
        workspace = await self.workspace_repo.get_by_id(workspace_id)
        member = await self._require_membership(user.id, workspace_id)
        return self._to_response(workspace, member.role)

    async def update_workspace(self, user: User, workspace_id: int, data: WorkspaceUpdate) -> WorkspaceResponse:
        member = await self._require_membership(user.id, workspace_id)
        self._check_roles(member.role, WorkspaceRole.OWNER, WorkspaceRole.ADMIN)

        update_data: dict = {}
        if data.name is not None:
            update_data["name"] = data.name
            update_data["slug"] = await self._generate_unique_slug(data.name)

        await self.workspace_repo.update(workspace_id, **update_data)
        await self.db.commit()

        workspace = await self.workspace_repo.get_by_id(workspace_id)
        logger.info("Workspace updated", workspace_id=workspace_id)
        return self._to_response(workspace, member.role)

    async def delete_workspace(self, user: User, workspace_id: int) -> None:
        workspace = await self.workspace_repo.get_by_id(workspace_id)
        member = await self._require_membership(user.id, workspace_id)
        self._check_roles(member.role, WorkspaceRole.OWNER)

        if workspace.is_personal:
            raise ForbiddenException("Cannot delete personal workspace")

        await self.workspace_repo.soft_delete(workspace_id)
        invitation_repo = InvitationRepository(self.db)
        await invitation_repo.cancel_all_for_workspace(workspace_id)
        await self.db.commit()
        logger.info("Workspace deleted", workspace_id=workspace_id)

    async def transfer_ownership(
        self, user: User, workspace_id: int, data: TransferOwnershipRequest
    ) -> WorkspaceResponse:
        workspace = await self.workspace_repo.get_by_id(workspace_id)

        if workspace.is_personal:
            raise ForbiddenException("Cannot transfer ownership of personal workspace")

        actor_member = await self._require_membership(user.id, workspace_id)
        self._check_roles(actor_member.role, WorkspaceRole.OWNER)

        target_member = await self.member_repo.get_by_id(data.target_member_id)
        if target_member.workspace_id != workspace_id:
            raise NotFoundException("Member not found in this workspace")

        if target_member.role == WorkspaceRole.OWNER:
            raise ConflictException("Target member is already the owner")

        target_member.role = WorkspaceRole.OWNER
        actor_member.role = WorkspaceRole.ADMIN
        await self.db.flush()
        await self.db.commit()

        workspace = await self.workspace_repo.get_by_id(workspace_id)
        logger.info(
            "Ownership transferred",
            workspace_id=workspace_id,
            from_user_id=user.id,
            to_user_id=target_member.user_id,
        )
        return self._to_response(workspace, actor_member.role)

    async def _resolve_company_id(self, user: User, company_id: int | None) -> int:
        if company_id is not None:
            company = await self.company_repo.get_by_id(company_id)
            return company.id
        personal_ws = await self.workspace_repo.get_personal(user.id)
        if personal_ws:
            return personal_ws.company_id
        default = await self.company_repo.get_default()
        return default.id

    async def _require_membership(self, user_id: int, workspace_id: int):
        member = await self.member_repo.get_membership(user_id, workspace_id)
        if not member:
            user_repo = UserRepository(self.db)
            user = await user_repo.get_by_id_or_none(user_id)
            if user and user.is_platform_owner:
                return _make_synthetic_viewer(user_id, workspace_id)
            raise NotFoundException("Workspace not found")
        return member

    @staticmethod
    def _check_roles(role: WorkspaceRole, *allowed: WorkspaceRole) -> None:
        if role not in allowed:
            raise ForbiddenException("Insufficient permissions")

    async def _generate_unique_slug(self, name: str) -> str:
        import secrets

        base_slug = slugify(name)
        if not base_slug:
            base_slug = "workspace"

        slug = base_slug
        existing = await self.workspace_repo.get_by_slug(slug)
        if existing:
            slug = f"{base_slug}-{secrets.token_hex(3)}"
        return slug

    @staticmethod
    def _to_response(workspace: Workspace, role: WorkspaceRole) -> WorkspaceResponse:
        return WorkspaceResponse(
            id=workspace.id,
            name=workspace.name,
            slug=workspace.slug,
            is_personal=workspace.is_personal,
            role=role,
            company_id=workspace.company_id,
            company_name=workspace.company.name,
            created_at=workspace.created_at,
        )
