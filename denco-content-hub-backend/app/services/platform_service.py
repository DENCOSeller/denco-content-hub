from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.exceptions import ConflictException
from app.repositories.user_repository import UserRepository
from app.repositories.workspace_member_repository import WorkspaceMemberRepository
from app.repositories.workspace_repository import WorkspaceRepository
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.platform import (
    PlatformJoinRequest,
    PlatformUserResponse,
    PlatformWorkspaceResponse,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.user import User
    from app.models.workspace import WorkspaceMember

logger = structlog.get_logger()


class PlatformService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.workspace_repo = WorkspaceRepository(db)
        self.member_repo = WorkspaceMemberRepository(db)
        self.user_repo = UserRepository(db)

    async def list_workspaces(
        self,
        params: PaginationParams,
        search: str | None = None,
        include_personal: bool = False,
        company_id: int | None = None,
    ) -> PaginatedResponse[PlatformWorkspaceResponse]:
        page = await self.workspace_repo.get_all_workspaces(params, search, include_personal, company_id)
        items = [await self._to_workspace_response(ws) for ws in page.items]
        return PaginatedResponse(
            items=items,
            total=page.total,
            page=page.page,
            size=page.size,
            pages=page.pages,
        )

    async def get_workspace_detail(self, workspace_id: int) -> PlatformWorkspaceResponse:
        workspace = await self.workspace_repo.get_by_id(workspace_id)
        return await self._to_workspace_response(workspace)

    async def join_workspace(self, user: User, workspace_id: int, data: PlatformJoinRequest) -> WorkspaceMember:
        workspace = await self.workspace_repo.get_by_id(workspace_id)
        existing = await self.member_repo.get_membership(user.id, workspace.id)
        if existing:
            raise ConflictException("Already a member of this workspace")

        member = await self.member_repo.add_member(user.id, workspace.id, data.role)
        await self.db.commit()
        logger.info("Platform owner joined workspace", user_id=user.id, workspace_id=workspace.id, role=data.role)
        return member

    async def list_users(
        self,
        params: PaginationParams,
        search: str | None = None,
    ) -> PaginatedResponse[PlatformUserResponse]:
        page = await self.user_repo.get_all_users(params, search)
        items = [await self._to_user_response(u) for u in page.items]
        return PaginatedResponse(
            items=items,
            total=page.total,
            page=page.page,
            size=page.size,
            pages=page.pages,
        )

    async def _to_workspace_response(self, workspace) -> PlatformWorkspaceResponse:
        members_count = await self.workspace_repo.get_members_count(workspace.id)
        content_count = await self.workspace_repo.get_content_count(workspace.id)
        return PlatformWorkspaceResponse(
            id=workspace.id,
            name=workspace.name,
            slug=workspace.slug,
            is_personal=workspace.is_personal,
            company_id=workspace.company_id,
            company_name=workspace.company.name,
            members_count=members_count,
            content_count=content_count,
            created_at=workspace.created_at,
        )

    async def _to_user_response(self, user) -> PlatformUserResponse:
        workspaces_count = await self.user_repo.get_workspaces_count(user.id)
        return PlatformUserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            is_active=user.is_active,
            is_platform_owner=user.is_platform_owner,
            workspaces_count=workspaces_count,
            created_at=user.created_at,
        )
