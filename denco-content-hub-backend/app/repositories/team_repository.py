from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import delete, select

from app.models.team import Team, TeamMember, TeamWorkspaceAccess
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams


class TeamRepository(BaseRepository[Team]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Team, db)

    async def get_by_staff_team_id(self, staff_team_id: int) -> Team | None:
        query = select(Team).where(Team.staff_team_id == staff_team_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_organization_id(self, organization_id: int) -> list[Team]:
        query = select(Team).where(Team.organization_id == organization_id).order_by(Team.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def list_by_organization(
        self, organization_id: int, params: PaginationParams
    ) -> PaginatedResponse[Team]:
        query = select(Team).where(Team.organization_id == organization_id).order_by(Team.name)
        return await self.paginate(query, params)


class TeamMemberRepository(BaseRepository[TeamMember]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(TeamMember, db)

    async def get_membership(self, team_id: int, user_id: int) -> TeamMember | None:
        query = select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_user_team_ids(self, user_id: int) -> list[int]:
        """Get all team IDs for a user."""
        query = select(TeamMember.team_id).where(TeamMember.user_id == user_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_members(self, team_id: int) -> int:
        from sqlalchemy import func

        query = select(func.count()).where(TeamMember.team_id == team_id)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def remove_user_from_all_teams(self, user_id: int) -> None:
        """Remove user from all teams (used during resync)."""
        stmt = delete(TeamMember).where(TeamMember.user_id == user_id)
        await self.db.execute(stmt)

    async def list_members(self, team_id: int) -> list[TeamMember]:
        query = select(TeamMember).where(TeamMember.team_id == team_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())


class TeamWorkspaceAccessRepository(BaseRepository[TeamWorkspaceAccess]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(TeamWorkspaceAccess, db)

    async def get_access(self, team_id: int, workspace_id: int) -> TeamWorkspaceAccess | None:
        query = select(TeamWorkspaceAccess).where(
            TeamWorkspaceAccess.team_id == team_id,
            TeamWorkspaceAccess.workspace_id == workspace_id,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_by_team(self, team_id: int) -> list[TeamWorkspaceAccess]:
        query = (
            select(TeamWorkspaceAccess)
            .where(TeamWorkspaceAccess.team_id == team_id)
            .order_by(TeamWorkspaceAccess.workspace_id)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_user_team_workspace_role(
        self, user_id: int, workspace_id: int
    ) -> str | None:
        """Get the best (highest-priority) team role for a user in a workspace.

        Returns the default_role from team_workspace_access if user belongs
        to any team that has access to this workspace.
        """
        query = (
            select(TeamWorkspaceAccess.default_role)
            .join(TeamMember, TeamMember.team_id == TeamWorkspaceAccess.team_id)
            .where(
                TeamMember.user_id == user_id,
                TeamWorkspaceAccess.workspace_id == workspace_id,
            )
        )
        result = await self.db.execute(query)
        roles = list(result.scalars().all())
        if not roles:
            return None

        # Priority order: owner > admin > editor > contractor > viewer
        role_priority = {"owner": 0, "admin": 1, "editor": 2, "contractor": 3, "viewer": 4}
        return min(roles, key=lambda r: role_priority.get(r, 99))

    async def delete_access(self, team_id: int, workspace_id: int) -> None:
        stmt = delete(TeamWorkspaceAccess).where(
            TeamWorkspaceAccess.team_id == team_id,
            TeamWorkspaceAccess.workspace_id == workspace_id,
        )
        await self.db.execute(stmt)
