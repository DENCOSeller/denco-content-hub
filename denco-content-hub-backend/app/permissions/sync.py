"""Идемпотентная синхронизация реестра модулей с БД."""

from __future__ import annotations

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.models.module_permission import (
    ModulePermission,
    ModuleRegistry,
    PlanModuleAccess,
    RolePermissionTemplate,
)
from app.permissions.registry import ModuleDeclaration, get_all_modules

logger = structlog.get_logger()


async def _sync_module(db: AsyncSession, decl: ModuleDeclaration) -> int:
    """Синхронизировать одну декларацию модуля с БД."""
    result = await db.execute(
        select(ModuleRegistry).where(ModuleRegistry.code == decl.code),
    )
    mod_row = result.scalar_one_or_none()

    if mod_row is None:
        mod_row = ModuleRegistry(
            code=decl.code,
            name=decl.name,
            description=decl.description or None,
            icon=decl.icon or None,
            sort_order=decl.sort_order,
            is_core=decl.is_core,
        )
        db.add(mod_row)
        await db.flush()
        logger.info("module_registry.created", code=decl.code, id=mod_row.id)
    else:
        changed = False
        for attr, new_val in (
            ("name", decl.name),
            ("description", decl.description or None),
            ("icon", decl.icon or None),
            ("sort_order", decl.sort_order),
            ("is_core", decl.is_core),
        ):
            if getattr(mod_row, attr) != new_val:
                setattr(mod_row, attr, new_val)
                changed = True
        if changed:
            await db.flush()
            logger.info("module_registry.updated", code=decl.code)

    module_id: int = mod_row.id

    # --- module_permission ---
    existing_perms_result = await db.execute(
        select(ModulePermission).where(ModulePermission.module_id == module_id),
    )
    existing_perms: dict[str, ModulePermission] = {
        p.short_code: p for p in existing_perms_result.scalars().all()
    }

    perm_id_by_short: dict[str, int] = {}

    for idx, pdecl in enumerate(decl.permissions):
        full_code = f"{decl.code}.{pdecl.short_code}"
        perm_row = existing_perms.get(pdecl.short_code)

        if perm_row is None:
            perm_row = ModulePermission(
                module_id=module_id,
                code=full_code,
                short_code=pdecl.short_code,
                name=pdecl.name,
                description=pdecl.description or None,
                sort_order=pdecl.sort_order or idx,
            )
            db.add(perm_row)
            await db.flush()
            logger.info("module_permission.created", code=full_code)
        else:
            changed = False
            for attr, new_val in (
                ("code", full_code),
                ("name", pdecl.name),
                ("description", pdecl.description or None),
                ("sort_order", pdecl.sort_order or idx),
            ):
                if getattr(perm_row, attr) != new_val:
                    setattr(perm_row, attr, new_val)
                    changed = True
            if changed:
                await db.flush()

        perm_id_by_short[pdecl.short_code] = perm_row.id

    # --- plan_module_access ---
    existing_plans_result = await db.execute(
        select(PlanModuleAccess).where(PlanModuleAccess.module_id == module_id),
    )
    existing_plan_rows: list[PlanModuleAccess] = list(existing_plans_result.scalars().all())
    existing_tiers: set[str] = {row.plan_tier for row in existing_plan_rows}
    declared_tiers: set[str] = set(decl.plan_tiers)

    for tier in declared_tiers - existing_tiers:
        db.add(PlanModuleAccess(plan_tier=tier, module_id=module_id))
        logger.info("plan_module_access.created", module=decl.code, tier=tier)

    for row in existing_plan_rows:
        if row.plan_tier not in declared_tiers:
            await db.delete(row)
            logger.info("plan_module_access.removed", module=decl.code, tier=row.plan_tier)

    await db.flush()

    # --- role_permission_template ---
    existing_rpt_result = await db.execute(
        select(RolePermissionTemplate.role, RolePermissionTemplate.permission_id).where(
            RolePermissionTemplate.permission_id.in_(list(perm_id_by_short.values())),
        ),
    )
    existing_rpt: set[tuple[str, int]] = {
        (row[0], row[1]) for row in existing_rpt_result.all()
    }

    for role, short_codes in decl.default_roles.items():
        for sc in short_codes:
            pid = perm_id_by_short.get(sc)
            if pid is None:
                logger.warning(
                    "role_template.unknown_permission",
                    module=decl.code, role=role, short_code=sc,
                )
                continue
            if (role, pid) not in existing_rpt:
                db.add(RolePermissionTemplate(role=role, permission_id=pid))
                logger.info(
                    "role_permission_template.created",
                    module=decl.code, role=role, permission=f"{decl.code}.{sc}",
                )

    await db.flush()
    return module_id


async def sync_module_registry() -> None:
    """Синхронизировать ВСЕ зарегистрированные модули с БД."""
    modules = get_all_modules()
    if not modules:
        logger.warning("sync_module_registry: no modules registered, skipping")
        return

    async with async_session_factory() as db:
        try:
            for decl in modules.values():
                await _sync_module(db, decl)
            await db.commit()
            logger.info("sync_module_registry.done", modules_count=len(modules))
        except Exception:
            await db.rollback()
            logger.exception("sync_module_registry.failed")
            raise
