"""Service for syncing teams from Staff Service JWT and API."""

from __future__ import annotations

from typing import TYPE_CHECKING

import httpx
import structlog

from app.config import settings
from app.repositories.team_repository import TeamMemberRepository, TeamRepository

if TYPE_CHECKING:
    from denco_auth import AuthPayload
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.user import User

logger = structlog.get_logger()


async def _fetch_team_from_staff(staff_team_id: int, token: str) -> dict | None:
    """Fetch team details from Staff Service API.

    Returns dict with team info or None if unavailable.
    """
    url = f"{settings.staff_service_url}/api/v1/teams/{staff_team_id}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
            if resp.status_code == 200:
                return resp.json()
            logger.warning(
                "Staff Service team fetch failed",
                staff_team_id=staff_team_id,
                status=resp.status_code,
            )
    except Exception:
        logger.warning(
            "Staff Service unreachable for team sync",
            staff_team_id=staff_team_id,
            exc_info=True,
        )
    return None


async def sync_teams_from_jwt(
    payload: AuthPayload,
    user: User,
    organization_id: int,
    token: str,
    db: AsyncSession,
) -> None:
    """Sync team memberships from JWT active_org.teams.

    This is called during SSO authentication. It:
    1. Reads team IDs from payload.active_org.teams
    2. For each team: ensures local Team record exists (fetching from Staff if needed)
    3. Updates TeamMember records for the current user

    Errors are logged but do NOT block authentication.
    """
    active_org = payload.active_org
    if active_org is None:
        return

    team_ids: list[int] = getattr(active_org, "teams", None) or []
    if not team_ids:
        return

    try:
        team_repo = TeamRepository(db)
        member_repo = TeamMemberRepository(db)

        for staff_team_id in team_ids:
            # Check if team already exists locally
            team = await team_repo.get_by_staff_team_id(staff_team_id)

            if not team:
                # Fetch from Staff Service API
                team_data = await _fetch_team_from_staff(staff_team_id, token)
                if team_data:
                    team = await team_repo.create(
                        staff_team_id=staff_team_id,
                        organization_id=organization_id,
                        name=team_data.get("name", f"Team {staff_team_id}"),
                        slug=team_data.get("slug", f"team-{staff_team_id}"),
                    )
                    logger.info(
                        "Synced team from Staff Service",
                        team_id=team.id,
                        staff_team_id=staff_team_id,
                    )
                else:
                    # Create with minimal info if Staff Service is unavailable
                    team = await team_repo.create(
                        staff_team_id=staff_team_id,
                        organization_id=organization_id,
                        name=f"Team {staff_team_id}",
                        slug=f"team-{staff_team_id}",
                    )
                    logger.info(
                        "Created placeholder team (Staff Service unavailable)",
                        team_id=team.id,
                        staff_team_id=staff_team_id,
                    )

            # Ensure user is a member of this team
            existing = await member_repo.get_membership(team.id, user.id)
            if not existing:
                await member_repo.create(
                    team_id=team.id,
                    user_id=user.id,
                    role="team_member",
                )

        await db.flush()
        logger.info(
            "Teams synced from JWT",
            user_id=user.id,
            team_count=len(team_ids),
        )

    except Exception:
        logger.warning(
            "Team sync from JWT failed — continuing auth",
            user_id=user.id,
            exc_info=True,
        )
