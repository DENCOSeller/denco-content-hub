from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import make_transient

from app.database import get_db
from app.exceptions import ForbiddenException, NotFoundException, UnauthorizedException
from app.models.company_member import CompanyMember, CompanyRole
from app.models.workspace import WorkspaceMember, WorkspaceRole
from app.repositories.company_member_repository import CompanyMemberRepository
from app.repositories.user_repository import UserRepository
from app.repositories.workspace_member_repository import WorkspaceMemberRepository
from app.repositories.workspace_repository import WorkspaceRepository
from app.utils.security import decode_token

if TYPE_CHECKING:
    from collections.abc import Sequence

    from redis.asyncio import Redis
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.user import User
    from app.models.workspace import Workspace

security_scheme = HTTPBearer()


def _make_synthetic_viewer(user_id: int, workspace_id: int) -> WorkspaceMember:
    """Create a synthetic VIEWER member for platform owner read-only access."""
    member = WorkspaceMember(id=-1, user_id=user_id, workspace_id=workspace_id, role=WorkspaceRole.VIEWER)
    make_transient(member)
    return member


async def get_redis() -> Redis:
    from app.main import redis_pool

    return redis_pool


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate Bearer token, return active user."""
    try:
        payload = decode_token(credentials.credentials)
    except JWTError as err:
        raise UnauthorizedException("Invalid token") from err

    if payload.get("type") != "access":
        raise UnauthorizedException("Invalid token type")

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedException("Invalid token payload")

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id_or_none(int(user_id))
    if not user:
        raise UnauthorizedException("User not found")

    if not user.is_active:
        raise UnauthorizedException("Account is deactivated")

    return user


async def require_platform_owner(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require the current user to be a platform owner."""
    if not current_user.is_platform_owner:
        raise ForbiddenException("Platform owner access required")
    return current_user


async def get_workspace_from_path(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> tuple[Workspace, WorkspaceMember]:
    """Resolve workspace from path param and verify user membership."""
    workspace_repo = WorkspaceRepository(db)
    member_repo = WorkspaceMemberRepository(db)

    workspace = await workspace_repo.get_by_id(workspace_id)
    member = await member_repo.get_membership(current_user.id, workspace.id)

    if not member and current_user.is_platform_owner:
        member = _make_synthetic_viewer(current_user.id, workspace.id)

    if not member:
        raise NotFoundException("Workspace not found")

    return workspace, member


def require_role(
    member: WorkspaceMember,
    allowed_roles: Sequence[WorkspaceRole],
) -> None:
    """Raise ForbiddenException if member role is not in allowed_roles."""
    if member.role not in allowed_roles:
        raise ForbiddenException("Insufficient permissions")


async def get_company_member(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CompanyMember:
    """Resolve company membership for current user."""
    member_repo = CompanyMemberRepository(db)
    member = await member_repo.get_membership(company_id, current_user.id)

    if not member and current_user.is_platform_owner:
        member = CompanyMember(id=-1, user_id=current_user.id, company_id=company_id, role=CompanyRole.MEMBER)
        make_transient(member)

    if not member:
        raise ForbiddenException("Not a company member")

    return member


async def require_company_admin(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CompanyMember:
    """Require current user to be company OWNER or ADMIN. Returns member."""
    member_repo = CompanyMemberRepository(db)
    member = await member_repo.get_membership(company_id, current_user.id)

    if not member and current_user.is_platform_owner:
        member = CompanyMember(id=-1, user_id=current_user.id, company_id=company_id, role=CompanyRole.ADMIN)
        make_transient(member)

    if not member or member.role not in (CompanyRole.OWNER, CompanyRole.ADMIN):
        raise ForbiddenException("Insufficient permissions")

    return member
