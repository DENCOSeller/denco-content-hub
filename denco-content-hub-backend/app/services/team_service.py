"""Service for managing teams and team workspace access."""

from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.exceptions import ConflictException, NotFoundException
from app.repositories.team_repository import (
    TeamMemberRepository,
    TeamRepository,
    TeamWorkspaceAccessRepository,
)
from app.repositories.workspace_repository import WorkspaceRepository
from app.schemas.team import (
    TeamResponse,
    TeamWorkspaceAccessCreate,
    TeamWorkspaceAccessResponse,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams

logger = structlog.get_logger()


class TeamService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.team_repo = TeamRepository(db)
        self.member_repo = TeamMemberRepository(db)
        self.access_repo = TeamWorkspaceAccessRepository(db)
        self.workspace_repo = WorkspaceRepository(db)

    async def list_teams(
        self, organization_id: int, params: PaginationParams
    ) -> PaginatedResponse[TeamResponse]:
        """List teams for an organization with member counts."""
        paginated = await self.team_repo.list_by_organization(organization_id, params)

        items = []
        for team in paginated.items:
            member_count = await self.member_repo.count_members(team.id)
            items.append(
                TeamResponse(
                    id=team.id,
                    staff_team_id=team.staff_team_id,
                    organization_id=team.organization_id,
                    name=team.name,
                    slug=team.slug,
                    member_count=member_count,
                    synced_at=team.synced_at,
                    created_at=team.created_at,
                )
            )

        return type(paginated)(
            items=items,
            total=paginated.total,
            page=paginated.page,
            size=paginated.size,
            pages=paginated.pages,
        )

    async def get_workspace_access(self, team_id: int) -> list[TeamWorkspaceAccessResponse]:
        """Get workspace access list for a team."""
        team = await self.team_repo.get_by_id(team_id)
        access_list = await self.access_repo.list_by_team(team.id)

        result = []
        for access in access_list:
            try:
                workspace = await self.workspace_repo.get_by_id(access.workspace_id)
                result.append(
                    TeamWorkspaceAccessResponse(
                        id=access.id,
                        team_id=access.team_id,
                        workspace_id=access.workspace_id,
                        workspace_name=workspace.name,
                        workspace_slug=workspace.slug,
                        default_role=access.default_role,
                        created_at=access.created_at,
                    )
                )
            except NotFoundException:
                # Workspace was deleted, skip
                continue

        return result

    async def add_workspace_access(
        self, team_id: int, data: TeamWorkspaceAccessCreate
    ) -> TeamWorkspaceAccessResponse:
        """Grant a team access to a workspace."""
        team = await self.team_repo.get_by_id(team_id)
        workspace = await self.workspace_repo.get_by_id(data.workspace_id)

        # Ensure workspace belongs to the same organization
        if workspace.organization_id != team.organization_id:
            raise ConflictException("Workspace and team must belong to the same organization")

        # Check if access already exists
        existing = await self.access_repo.get_access(team.id, workspace.id)
        if existing:
            raise ConflictException("Team already has access to this workspace")

        access = await self.access_repo.create(
            team_id=team.id,
            workspace_id=workspace.id,
            default_role=data.default_role,
        )
        await self.db.commit()

        logger.info(
            "Team workspace access granted",
            team_id=team.id,
            workspace_id=workspace.id,
            role=data.default_role,
        )

        return TeamWorkspaceAccessResponse(
            id=access.id,
            team_id=access.team_id,
            workspace_id=access.workspace_id,
            workspace_name=workspace.name,
            workspace_slug=workspace.slug,
            default_role=access.default_role,
            created_at=access.created_at,
        )

    async def remove_workspace_access(self, team_id: int, workspace_id: int) -> None:
        """Remove team access to a workspace."""
        team = await self.team_repo.get_by_id(team_id)
        existing = await self.access_repo.get_access(team.id, workspace_id)
        if not existing:
            raise NotFoundException("Team workspace access not found")

        await self.access_repo.delete_access(team.id, workspace_id)
        await self.db.commit()

        logger.info(
            "Team workspace access removed",
            team_id=team.id,
            workspace_id=workspace_id,
        )
