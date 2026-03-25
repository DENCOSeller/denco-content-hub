"""API управления модулями и разрешениями Content Hub Backend."""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_user
from app.exceptions import ForbiddenException, NotFoundException
from app.models.module_permission import (
    ModulePermission,
    ModuleRegistry,
    OrgModuleConfig,
    PlanModuleAccess,
    RolePermissionTemplate,
)
from app.models.organization_member import OrganizationMember
from app.permissions.registry import get_all_modules
from app.permissions.schemas import (
    ModuleResponse,
    MyPermissionsResponse,
    PermissionDetailResponse,
    RoleTemplateResponse,
)
from app.permissions.service import resolve_user_permissions

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.user import User

router = APIRouter(
    prefix="/organizations/{organization_id}/permissions",
    tags=["permissions"],
)


async def _get_org_membership(
    db: AsyncSession,
    organization_id: int,
    user_id: int,
) -> OrganizationMember:
    """Получить членство пользователя в организации или 403."""
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
        ),
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise ForbiddenException("User is not a member of this organization")
    return member


# ---------------------------------------------------------------------------
# GET /permissions/my — разрешения текущего пользователя
# ---------------------------------------------------------------------------


@router.get(
    "/my",
    response_model=MyPermissionsResponse,
    summary="Get current user's effective permissions",
)
async def get_my_permissions(
    organization_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MyPermissionsResponse:
    """Вернуть действующие разрешения текущего пользователя в организации."""
    member = await _get_org_membership(db, organization_id, current_user.id)

    role = member.role if isinstance(member.role, str) else member.role.value

    perms = await resolve_user_permissions(
        org_id=organization_id,
        user_id=current_user.id,
        role=role,
        _db=db,
    )

    # CH пока на free плане
    plan_tier = "free"

    config_result = await db.execute(
        select(ModuleRegistry.code, OrgModuleConfig.is_enabled)
        .join(OrgModuleConfig, OrgModuleConfig.module_id == ModuleRegistry.id)
        .where(OrgModuleConfig.organization_id == organization_id),
    )
    org_configs: dict[str, bool] = {row[0]: row[1] for row in config_result.all()}

    all_modules = get_all_modules()
    enabled_modules = [
        code
        for code in sorted(all_modules.keys())
        if org_configs.get(code, True)
    ]

    return MyPermissionsResponse(
        permissions=sorted(perms),
        enabled_modules=enabled_modules,
        role=role,
        plan=plan_tier,
    )


# ---------------------------------------------------------------------------
# GET /permissions/modules — список модулей со статусом
# ---------------------------------------------------------------------------


@router.get(
    "/modules",
    response_model=list[ModuleResponse],
    summary="List all modules with organization status",
)
async def list_modules(
    organization_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ModuleResponse]:
    """Вернуть все модули с их статусом включения для организации."""
    await _get_org_membership(db, organization_id, current_user.id)

    plan_tier = "free"

    plan_modules_result = await db.execute(
        select(ModuleRegistry.code)
        .join(PlanModuleAccess, PlanModuleAccess.module_id == ModuleRegistry.id)
        .where(PlanModuleAccess.plan_tier == plan_tier),
    )
    plan_allowed: set[str] = {row[0] for row in plan_modules_result.all()}

    config_result = await db.execute(
        select(ModuleRegistry.code, OrgModuleConfig.is_enabled, OrgModuleConfig.enabled_at)
        .join(OrgModuleConfig, OrgModuleConfig.module_id == ModuleRegistry.id)
        .where(OrgModuleConfig.organization_id == organization_id),
    )
    org_configs: dict[str, tuple[bool, ...]] = {
        row[0]: (row[1], row[2]) for row in config_result.all()
    }

    from sqlalchemy import func

    perm_count_result = await db.execute(
        select(ModuleRegistry.code, func.count(ModulePermission.id))
        .join(ModulePermission, ModulePermission.module_id == ModuleRegistry.id)
        .group_by(ModuleRegistry.code),
    )
    perm_counts: dict[str, int] = {row[0]: row[1] for row in perm_count_result.all()}

    all_modules = get_all_modules()
    result: list[ModuleResponse] = []

    for code, decl in sorted(all_modules.items(), key=lambda x: x[1].sort_order):
        is_available = code in plan_allowed

        if code in org_configs:
            is_enabled, enabled_at = org_configs[code]
        else:
            is_enabled = True
            enabled_at = None

        plan_required: str | None = None
        if not is_available and decl.plan_tiers:
            plan_required = decl.plan_tiers[0]

        result.append(
            ModuleResponse(
                code=code,
                name=decl.name,
                icon=decl.icon or None,
                description=decl.description or None,
                is_core=decl.is_core,
                is_enabled=is_enabled,
                is_available=is_available,
                plan_required=plan_required,
                enabled_at=enabled_at,
                permissions_count=perm_counts.get(code, len(decl.permissions)),
            ),
        )

    return result


# ---------------------------------------------------------------------------
# GET /permissions/roles/{role}/template — шаблон разрешений роли
# ---------------------------------------------------------------------------


@router.get(
    "/roles/{role}/template",
    response_model=RoleTemplateResponse,
    summary="Get default permission template for a role",
)
async def get_role_template(
    organization_id: int,
    role: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RoleTemplateResponse:
    """Вернуть шаблон разрешений для системной роли."""
    await _get_org_membership(db, organization_id, current_user.id)

    template_result = await db.execute(
        select(ModulePermission.code)
        .join(RolePermissionTemplate, RolePermissionTemplate.permission_id == ModulePermission.id)
        .where(RolePermissionTemplate.role == role),
    )
    template_perms: set[str] = {row[0] for row in template_result.all()}

    all_modules = get_all_modules()
    details: list[PermissionDetailResponse] = []

    for mod_code, decl in sorted(all_modules.items(), key=lambda x: x[1].sort_order):
        for pdecl in decl.permissions:
            full_code = f"{mod_code}.{pdecl.short_code}"
            granted = full_code in template_perms
            details.append(
                PermissionDetailResponse(
                    code=full_code,
                    module=mod_code,
                    name=pdecl.name,
                    source="role_template",
                    granted=granted,
                ),
            )

    return RoleTemplateResponse(role=role, permissions=details)
