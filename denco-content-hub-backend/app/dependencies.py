from __future__ import annotations

from typing import TYPE_CHECKING

import structlog
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
from app.utils.security import hash_password
from app.utils.sso import decode_sso_token

if TYPE_CHECKING:
    from collections.abc import Sequence

    from redis.asyncio import Redis
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.user import User
    from app.models.workspace import Workspace

logger = structlog.get_logger()

security_scheme = HTTPBearer()

# --- JWT magic string constants ---

_DEFAULT_ORG_ROLE = "org_member"
_DEFAULT_COMPANY_ROLE = CompanyRole.MEMBER


class JWTPlatformRole:
    """Значения platform_role из JWT Staff Service."""

    SUPER_ADMIN = "super_admin"
    PLATFORM_ADMIN = "platform_admin"
    PLATFORM_STAFF = "platform_staff"


def _make_synthetic_viewer(user_id: int, workspace_id: int) -> WorkspaceMember:
    """Create a synthetic VIEWER member for platform owner read-only access."""
    member = WorkspaceMember(id=-1, user_id=user_id, workspace_id=workspace_id, role=WorkspaceRole.VIEWER)
    make_transient(member)
    return member


async def get_redis() -> Redis:
    from app.main import redis_pool

    return redis_pool


_ORG_ROLE_MAP: dict[str, CompanyRole] = {
    "org_owner": CompanyRole.OWNER,
    "org_admin": CompanyRole.ADMIN,
    "org_member": CompanyRole.MEMBER,
    "org_viewer": CompanyRole.VIEWER,
}


def _has_content_hub_access(payload: dict) -> bool:
    """Check if JWT grants access to content_hub via organizations or legacy products."""
    organizations: list[dict] = payload.get("organizations") or []
    if organizations:
        return any("content_hub" in (org.get("products") or []) for org in organizations)
    # Fallback: legacy top-level products
    return "content_hub" in (payload.get("products") or [])


async def _sync_org_memberships(
    user: User,
    organizations: list[dict],
    db: AsyncSession,
) -> None:
    """Sync company memberships from JWT v2 organizations[] array."""
    from app.repositories.company_repository import CompanyRepository
    from app.utils.slugify import slugify

    company_repo = CompanyRepository(db)
    member_repo = CompanyMemberRepository(db)

    for org in organizations:
        org_products: list[str] = org.get("products") or []
        if "content_hub" not in org_products:
            continue

        staff_org_id: int = int(org["org_id"])
        org_slug: str = org.get("org_slug", "")
        org_role_str: str = org.get("org_role", _DEFAULT_ORG_ROLE)

        # Find company by staff_org_id first, then by slug
        company = await company_repo.get_by_staff_org_id(staff_org_id)
        if not company and org_slug:
            company = await company_repo.get_by_slug(org_slug)
            if company:
                company.staff_org_id = staff_org_id
                await db.flush()

        # Auto-create company if not found
        if not company:
            slug = org_slug or slugify(f"org-{staff_org_id}")
            if await company_repo.slug_exists(slug):
                slug = f"{slug}-{staff_org_id}"
            company = await company_repo.create(
                name=org_slug or f"Organization {staff_org_id}",
                slug=slug,
                staff_org_id=staff_org_id,
            )
            logger.info(
                "Auto-created company from JWT org",
                company_id=company.id,
                staff_org_id=staff_org_id,
                slug=slug,
            )

        # Sync membership
        target_role = _ORG_ROLE_MAP.get(org_role_str, _DEFAULT_COMPANY_ROLE)
        membership = await member_repo.get_membership(company.id, user.id)
        if not membership:
            await member_repo.add_member(company.id, user.id, target_role)
            logger.info(
                "Created company membership from JWT",
                user_id=user.id,
                company_id=company.id,
                role=target_role.value,
            )
        elif membership.role != target_role:
            await member_repo.update_role(membership, target_role)
            logger.info(
                "Updated company membership role from JWT",
                user_id=user.id,
                company_id=company.id,
                old_role=membership.role.value,
                new_role=target_role.value,
            )


async def _resolve_sso_user(payload: dict, db: AsyncSession) -> User:
    """Resolve or auto-provision a local user from an SSO token payload.

    Lookup order:
    1. By staff_employee_id (fastest, already linked)
    2. By email (link existing user)
    3. Create new user (auto-provision)
    """
    employee_id = int(payload["sub"])
    email: str = payload.get("email", "")
    name: str = payload.get("name", email.split("@")[0])
    platform_role: str | None = payload.get("platform_role")
    organizations: list[dict] = payload.get("organizations") or []

    if not _has_content_hub_access(payload):
        raise ForbiddenException("No access to Content Hub")

    user_repo = UserRepository(db)
    is_new_user = False

    # 1. Lookup by staff_employee_id
    user = await user_repo.get_by_staff_employee_id(employee_id)
    if not user:
        # 2. Lookup by email — link existing user
        user = await user_repo.get_by_email(email)
        if user:
            user.staff_employee_id = employee_id
            await db.flush()
            logger.info("Linked existing user to SSO", user_id=user.id, staff_employee_id=employee_id)

    if not user:
        # 3. Auto-provision new user
        import secrets

        user = await user_repo.create(
            email=email,
            name=name,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            staff_employee_id=employee_id,
        )
        is_new_user = True

    if not user.is_active:
        raise UnauthorizedException("Account is deactivated")

    # Sync platform_role from JWT v2
    if platform_role is not None:
        user.platform_role = platform_role
        user.is_platform_owner = platform_role == JWTPlatformRole.SUPER_ADMIN
        await db.flush()

    # Sync organizations from JWT v2
    if organizations:
        await _sync_org_memberships(user, organizations, db)

    # For new users without org memberships — create personal workspace in default company
    if is_new_user and not organizations:
        from app.repositories.company_repository import CompanyRepository
        from app.services.workspace_service import WorkspaceService

        company_repo = CompanyRepository(db)
        default_company = await company_repo.get_default()
        workspace_service = WorkspaceService(db)
        await workspace_service.create_personal_workspace(user, company_id=default_company.id)

    await db.commit()
    if is_new_user:
        logger.info("Auto-provisioned SSO user", user_id=user.id, staff_employee_id=employee_id, email=email)
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate Bearer token, return active user.

    Only RS256 SSO tokens from Staff Service are accepted.
    """
    token = credentials.credentials

    try:
        sso_payload = await decode_sso_token(token)
    except JWTError as err:
        raise UnauthorizedException("Invalid SSO token") from err

    if sso_payload is None:
        raise UnauthorizedException("Invalid token: SSO token required")

    return await _resolve_sso_user(sso_payload, db)


async def require_platform_owner(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require the current user to be a platform owner."""
    if not current_user.is_platform_owner:
        raise ForbiddenException("Platform owner access required")
    return current_user


_PLATFORM_STAFF_ROLES = (
    JWTPlatformRole.SUPER_ADMIN,
    JWTPlatformRole.PLATFORM_ADMIN,
    JWTPlatformRole.PLATFORM_STAFF,
)


async def require_platform_staff(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require the current user to have any platform staff role."""
    if current_user.platform_role not in _PLATFORM_STAFF_ROLES:
        raise ForbiddenException("Platform staff access required")
    return current_user


def _is_platform_staff(user: User) -> bool:
    """Check if user has any platform staff role (read-only synthetic access)."""
    return getattr(user, "platform_role", None) in _PLATFORM_STAFF_ROLES


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

    if not member and (current_user.is_platform_owner or _is_platform_staff(current_user)):
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

    if not member and (current_user.is_platform_owner or _is_platform_staff(current_user)):
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
