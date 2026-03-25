"""Сервис резолвинга разрешений с Redis + LRU кэшированием.

Приоритет резолвинга:
1. Модуль включён? → проверка org_module_config
2. Plan gate → проверка plan_module_access
3. Explicit user grant → проверка user_permission_grant
4. Role template → проверка role_permission_template
5. Default → FALSE
"""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

from cachetools import TTLCache
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.models.module_permission import (
    ModulePermission,
    ModuleRegistry,
    OrgModuleConfig,
    PlanModuleAccess,
    RolePermissionTemplate,
    UserPermissionGrant,
)

if TYPE_CHECKING:
    from redis.asyncio import Redis

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-process LRU кэши
# ---------------------------------------------------------------------------
_user_perm_cache: TTLCache[tuple[int, int], set[str]] = TTLCache(maxsize=256, ttl=30)
_org_modules_cache: TTLCache[int, dict[str, bool]] = TTLCache(maxsize=128, ttl=30)

_REDIS_USER_PERM_KEY = "perm:org:{org_id}:user:{user_id}"
_REDIS_ORG_MODULES_KEY = "perm:org:{org_id}:modules"
_REDIS_TTL = 300


def _get_redis() -> Redis:
    """Получить глобальный Redis pool."""
    from app.main import redis_pool
    return redis_pool


async def _redis_get(key: str) -> str | None:
    """Получить значение из Redis."""
    try:
        redis = _get_redis()
        return await redis.get(key)
    except Exception:
        logger.debug("redis_get_error", exc_info=True)
        return None


async def _redis_set(key: str, value: str, ttl: int = _REDIS_TTL) -> None:
    """Установить значение в Redis с TTL."""
    try:
        redis = _get_redis()
        await redis.set(key, value, ex=ttl)
    except Exception:
        logger.debug("redis_set_error", exc_info=True)


async def _redis_delete(*keys: str) -> None:
    """Удалить ключи из Redis."""
    if not keys:
        return
    try:
        redis = _get_redis()
        await redis.delete(*keys)
    except Exception:
        logger.debug("redis_delete_error", exc_info=True)


async def _redis_scan_delete(pattern: str) -> None:
    """Удалить ключи по паттерну из Redis."""
    try:
        redis = _get_redis()
        cursor = 0
        while True:
            cursor, keys = await redis.scan(cursor=cursor, match=pattern, count=100)
            if keys:
                await redis.delete(*keys)
            if cursor == 0:
                break
    except Exception:
        logger.debug("redis_scan_delete_error", exc_info=True)


# ---------------------------------------------------------------------------
# Загрузчики данных
# ---------------------------------------------------------------------------

async def _load_org_enabled_modules(db: AsyncSession, org_id: int) -> dict[str, bool]:
    """Загрузить состояние модулей для организации."""
    redis_key = _REDIS_ORG_MODULES_KEY.format(org_id=org_id)

    cached = _org_modules_cache.get(org_id)
    if cached is not None:
        return cached

    redis_val = await _redis_get(redis_key)
    if redis_val is not None:
        try:
            modules = json.loads(redis_val)
            _org_modules_cache[org_id] = modules
            return modules
        except (json.JSONDecodeError, TypeError):
            pass

    result = await db.execute(
        select(ModuleRegistry.code, OrgModuleConfig.is_enabled)
        .join(OrgModuleConfig, OrgModuleConfig.module_id == ModuleRegistry.id)
        .where(OrgModuleConfig.organization_id == org_id),
    )
    modules: dict[str, bool] = {row[0]: row[1] for row in result.all()}

    _org_modules_cache[org_id] = modules
    await _redis_set(redis_key, json.dumps(modules))

    return modules


async def _load_plan_allowed_modules(db: AsyncSession, plan_tier: str) -> set[str]:
    """Загрузить коды модулей, разрешённых для тарифного плана."""
    result = await db.execute(
        select(ModuleRegistry.code)
        .join(PlanModuleAccess, PlanModuleAccess.module_id == ModuleRegistry.id)
        .where(PlanModuleAccess.plan_tier == plan_tier),
    )
    return {row[0] for row in result.all()}


async def _load_user_explicit_grants(
    db: AsyncSession, org_id: int, user_id: int,
) -> dict[str, bool]:
    """Загрузить явные разрешения/запреты пользователя."""
    result = await db.execute(
        select(ModulePermission.code, UserPermissionGrant.granted)
        .join(UserPermissionGrant, UserPermissionGrant.permission_id == ModulePermission.id)
        .where(
            UserPermissionGrant.organization_id == org_id,
            UserPermissionGrant.user_id == user_id,
        ),
    )
    return {row[0]: row[1] for row in result.all()}


async def _load_role_template_permissions(db: AsyncSession, role: str) -> set[str]:
    """Загрузить коды разрешений из шаблона роли."""
    result = await db.execute(
        select(ModulePermission.code)
        .join(RolePermissionTemplate, RolePermissionTemplate.permission_id == ModulePermission.id)
        .where(RolePermissionTemplate.role == role),
    )
    return {row[0] for row in result.all()}


# ---------------------------------------------------------------------------
# Основной резолвинг
# ---------------------------------------------------------------------------

async def resolve_user_permissions(
    org_id: int,
    user_id: int,
    role: str,
    *,
    _db: AsyncSession | None = None,
) -> set[str]:
    """Определить полный набор разрешений пользователя в организации."""
    cache_key = (org_id, user_id)

    cached = _user_perm_cache.get(cache_key)
    if cached is not None:
        return cached

    redis_key = _REDIS_USER_PERM_KEY.format(org_id=org_id, user_id=user_id)
    redis_val = await _redis_get(redis_key)
    if redis_val is not None:
        try:
            perms = set(json.loads(redis_val))
            _user_perm_cache[cache_key] = perms
            return perms
        except (json.JSONDecodeError, TypeError):
            pass

    async def _resolve(db: AsyncSession) -> set[str]:
        # CH пока на free плане
        plan_tier = "free"

        plan_allowed = await _load_plan_allowed_modules(db, plan_tier)
        org_modules = await _load_org_enabled_modules(db, org_id)
        explicit_grants = await _load_user_explicit_grants(db, org_id, user_id)
        role_perms = await _load_role_template_permissions(db, role)

        all_candidates: set[str] = set(role_perms)
        for perm_code, is_granted in explicit_grants.items():
            if is_granted:
                all_candidates.add(perm_code)
            else:
                all_candidates.discard(perm_code)

        granted: set[str] = set()
        for perm_code in all_candidates:
            module_code = perm_code.split(".")[0] if "." in perm_code else perm_code

            if module_code in org_modules and not org_modules[module_code]:
                continue

            if plan_allowed and module_code not in plan_allowed:
                continue

            granted.add(perm_code)

        return granted

    if _db is not None:
        perms = await _resolve(_db)
    else:
        async with async_session_factory() as db:
            perms = await _resolve(db)

    _user_perm_cache[cache_key] = perms
    await _redis_set(redis_key, json.dumps(sorted(perms)))

    return perms


async def check_modular_permission(
    org_id: int,
    user_id: int,
    role: str,
    permission_code: str,
    *,
    _db: AsyncSession | None = None,
) -> bool:
    """Проверить конкретное разрешение пользователя в организации."""
    perms = await resolve_user_permissions(
        org_id=org_id, user_id=user_id, role=role, _db=_db,
    )
    return permission_code in perms


# ---------------------------------------------------------------------------
# Инвалидация кэша
# ---------------------------------------------------------------------------

def invalidate_user_permissions(org_id: int, user_id: int) -> None:
    """Инвалидировать кэш разрешений конкретного пользователя."""
    cache_key = (org_id, user_id)
    _user_perm_cache.pop(cache_key, None)


async def invalidate_user_permissions_async(org_id: int, user_id: int) -> None:
    """Async инвалидация LRU + Redis."""
    invalidate_user_permissions(org_id, user_id)
    redis_key = _REDIS_USER_PERM_KEY.format(org_id=org_id, user_id=user_id)
    await _redis_delete(redis_key)


async def invalidate_org_permissions(org_id: int) -> None:
    """Инвалидировать ВСЕ кэши разрешений для организации."""
    keys_to_remove = [k for k in _user_perm_cache if k[0] == org_id]
    for k in keys_to_remove:
        _user_perm_cache.pop(k, None)

    _org_modules_cache.pop(org_id, None)

    await _redis_scan_delete(f"perm:org:{org_id}:*")
