from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from app.models.user import User
from app.models.workspace import WorkspaceMember, WorkspaceRole
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams


class WorkspaceMemberRepository(BaseRepository[WorkspaceMember]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(WorkspaceMember, db)

    async def get_membership(self, user_id: int, workspace_id: int) -> WorkspaceMember | None:
        query = select(WorkspaceMember).where(
            WorkspaceMember.user_id == user_id,
            WorkspaceMember.workspace_id == workspace_id,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def add_member(self, user_id: int, workspace_id: int, role: WorkspaceRole) -> WorkspaceMember:
        return await self.create(user_id=user_id, workspace_id=workspace_id, role=role)

    async def remove_member(self, member: WorkspaceMember) -> None:
        await self.db.delete(member)
        await self.db.flush()

    async def list_members(self, workspace_id: int, params: PaginationParams) -> PaginatedResponse[WorkspaceMember]:
        query = (
            select(WorkspaceMember)
            .join(User, User.id == WorkspaceMember.user_id)
            .where(
                WorkspaceMember.workspace_id == workspace_id,
                User.deleted_at.is_(None),
            )
            .order_by(WorkspaceMember.created_at)
        )
        return await self.paginate(query, params)
