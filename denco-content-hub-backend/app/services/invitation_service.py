from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

import structlog

from app.config import settings
from app.exceptions import ConflictException, ForbiddenException, NotFoundException
from app.models.invitation import InvitationStatus, WorkspaceInvitation
from app.models.workspace import WorkspaceRole
from app.repositories.invitation_repository import InvitationRepository
from app.repositories.user_repository import UserRepository
from app.repositories.workspace_member_repository import WorkspaceMemberRepository
from app.repositories.workspace_repository import WorkspaceRepository
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.invitation import (
    CreateInvitationRequest,
    InvitationPublicResponse,
    InvitationResponse,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.user import User
    from app.models.workspace import WorkspaceMember

logger = structlog.get_logger()

MAX_PENDING_INVITATIONS = 20
INVITATION_EXPIRY_DAYS = 7
MANAGE_ROLES = (WorkspaceRole.OWNER, WorkspaceRole.ADMIN)


class InvitationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.invitation_repo = InvitationRepository(db)
        self.member_repo = WorkspaceMemberRepository(db)
        self.workspace_repo = WorkspaceRepository(db)
        self.user_repo = UserRepository(db)

    async def create_invitation(
        self, actor: User, workspace_id: int, data: CreateInvitationRequest
    ) -> InvitationResponse:
        # Raises NotFoundException if deleted or missing (SoftDeleteMixin filter)
        await self.workspace_repo.get_by_id(workspace_id)

        actor_member = await self.member_repo.get_membership(actor.id, workspace_id)
        if not actor_member or actor_member.role not in MANAGE_ROLES:
            raise ForbiddenException("Insufficient permissions")

        pending_count = await self.invitation_repo.count_pending_by_workspace(workspace_id)
        if pending_count >= MAX_PENDING_INVITATIONS:
            raise ConflictException(f"Maximum {MAX_PENDING_INVITATIONS} pending invitations allowed")

        # If the invited email belongs to an existing user, check they're not already a member
        invited_user = await self.user_repo.get_by_email(data.email)
        if invited_user:
            existing = await self.member_repo.get_membership(invited_user.id, workspace_id)
            if existing:
                raise ConflictException("User is already a member of this workspace")

        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(UTC) + timedelta(days=INVITATION_EXPIRY_DAYS)

        invitation = await self.invitation_repo.create(
            workspace_id=workspace_id,
            email=str(data.email),
            role=data.role,
            invited_by_user_id=actor.id,
            token=token,
            expires_at=expires_at,
        )
        await self.db.commit()
        await self.db.refresh(invitation)

        logger.info("Invitation created", workspace_id=workspace_id, email=data.email, role=data.role)
        return _to_response(invitation)

    async def accept_invitation(self, token: str, current_user: User) -> WorkspaceMember:
        invitation = await self.invitation_repo.get_by_token_for_update(token)
        if invitation is None:
            raise NotFoundException("Invitation not found")

        if invitation.status != InvitationStatus.PENDING:
            raise ConflictException(f"Invitation is {invitation.status}")

        if invitation.expires_at < datetime.now(UTC):
            invitation.status = InvitationStatus.EXPIRED
            await self.db.flush()
            await self.db.commit()
            raise ConflictException("Invitation has expired")

        if invitation.email != current_user.email:
            raise ForbiddenException("This invitation is for a different email address")

        # get_by_id_or_none returns None for soft-deleted workspaces (SoftDeleteMixin)
        workspace = await self.workspace_repo.get_by_id_or_none(invitation.workspace_id)
        if workspace is None:
            invitation.status = InvitationStatus.CANCELLED
            await self.db.flush()
            await self.db.commit()
            raise NotFoundException("Workspace not found or has been deleted")

        existing = await self.member_repo.get_membership(current_user.id, invitation.workspace_id)
        if existing:
            raise ConflictException("Already a member of this workspace")

        member = await self.member_repo.add_member(
            user_id=current_user.id,
            workspace_id=invitation.workspace_id,
            role=invitation.role,
        )
        invitation.status = InvitationStatus.ACCEPTED
        await self.db.flush()
        await self.db.commit()

        logger.info(
            "Invitation accepted",
            invitation_id=invitation.id,
            workspace_id=invitation.workspace_id,
            user_id=current_user.id,
        )
        return member

    async def list_invitations(
        self, actor: User, workspace_id: int, params: PaginationParams
    ) -> PaginatedResponse[InvitationResponse]:
        actor_member = await self.member_repo.get_membership(actor.id, workspace_id)
        if not actor_member or actor_member.role not in MANAGE_ROLES:
            raise ForbiddenException("Insufficient permissions")

        page = await self.invitation_repo.list_by_workspace(workspace_id, params)
        items = [_to_response(inv) for inv in page.items]
        return PaginatedResponse(
            items=items,
            total=page.total,
            page=page.page,
            size=page.size,
            pages=page.pages,
        )

    async def cancel_invitation(self, actor: User, workspace_id: int, invitation_id: int) -> None:
        actor_member = await self.member_repo.get_membership(actor.id, workspace_id)
        if not actor_member or actor_member.role not in MANAGE_ROLES:
            raise ForbiddenException("Insufficient permissions")

        invitation = await self.invitation_repo.get_by_id(invitation_id)
        if invitation.workspace_id != workspace_id:
            raise NotFoundException("Invitation not found")

        if invitation.status != InvitationStatus.PENDING:
            raise ConflictException(f"Invitation is already {invitation.status}")

        invitation.status = InvitationStatus.CANCELLED
        await self.db.flush()
        await self.db.commit()

        logger.info("Invitation cancelled", invitation_id=invitation_id, actor_id=actor.id)

    async def get_invitation_info(self, token: str) -> InvitationPublicResponse:
        """Public endpoint — no auth required."""
        invitation = await self.invitation_repo.get_by_token(token)
        if invitation is None:
            raise NotFoundException("Invitation not found")

        if invitation.status != InvitationStatus.PENDING:
            raise NotFoundException("Invitation is no longer valid")

        if invitation.expires_at < datetime.now(UTC):
            raise ConflictException("Invitation has expired")

        workspace = await self.workspace_repo.get_by_id_or_none(invitation.workspace_id)
        if workspace is None:
            raise NotFoundException("Workspace not found")

        return InvitationPublicResponse(
            workspace_name=workspace.name,
            role=invitation.role,
            email=_mask_email(invitation.email),
            expires_at=invitation.expires_at,
        )

    async def cleanup_expired(self) -> int:
        """Mark all expired-but-still-PENDING invitations as EXPIRED. For Celery task."""
        from sqlalchemy import update as sa_update

        stmt = (
            sa_update(WorkspaceInvitation)
            .where(
                WorkspaceInvitation.status == InvitationStatus.PENDING,
                WorkspaceInvitation.expires_at < datetime.now(UTC),
            )
            .values(status=InvitationStatus.EXPIRED)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        count: int = result.rowcount  # type: ignore[attr-defined]
        if count:
            logger.info("Expired invitations cleaned up", count=count)
        return count


def _to_response(invitation: WorkspaceInvitation) -> InvitationResponse:
    return InvitationResponse(
        id=invitation.id,
        workspace_id=invitation.workspace_id,
        email=invitation.email,
        role=invitation.role,
        status=invitation.status,
        invite_link=f"{settings.frontend_url}/invite/{invitation.token}",
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
    )


def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    masked_local = local[0] + "***" if len(local) > 1 else "*"
    return f"{masked_local}@{domain}"
