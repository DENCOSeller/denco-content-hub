from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import func, select, update

from app.models.invitation import InvitationStatus, WorkspaceInvitation
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams


class InvitationRepository(BaseRepository[WorkspaceInvitation]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(WorkspaceInvitation, db)

    async def get_by_token(self, token: str) -> WorkspaceInvitation | None:
        query = select(WorkspaceInvitation).where(WorkspaceInvitation.token == token)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_token_for_update(self, token: str) -> WorkspaceInvitation | None:
        """SELECT ... FOR UPDATE — prevents race conditions on accept."""
        query = select(WorkspaceInvitation).where(WorkspaceInvitation.token == token).with_for_update()
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_pending_by_email(self, email: str) -> list[WorkspaceInvitation]:
        """Used during registration auto-accept."""
        query = select(WorkspaceInvitation).where(
            WorkspaceInvitation.email == email,
            WorkspaceInvitation.status == InvitationStatus.PENDING,
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def list_by_workspace(
        self, workspace_id: int, params: PaginationParams
    ) -> PaginatedResponse[WorkspaceInvitation]:
        query = (
            select(WorkspaceInvitation)
            .where(WorkspaceInvitation.workspace_id == workspace_id)
            .order_by(WorkspaceInvitation.created_at.desc())
        )
        return await self.paginate(query, params)

    async def count_pending_by_workspace(self, workspace_id: int) -> int:
        query = select(func.count()).where(
            WorkspaceInvitation.workspace_id == workspace_id,
            WorkspaceInvitation.status == InvitationStatus.PENDING,
        )
        result = await self.db.execute(query)
        return result.scalar_one()

    async def cancel_all_for_workspace(self, workspace_id: int) -> None:
        """Bulk-cancel all pending invitations when workspace is soft-deleted."""
        stmt = (
            update(WorkspaceInvitation)
            .where(
                WorkspaceInvitation.workspace_id == workspace_id,
                WorkspaceInvitation.status == InvitationStatus.PENDING,
            )
            .values(status=InvitationStatus.CANCELLED)
        )
        await self.db.execute(stmt)
        await self.db.flush()
