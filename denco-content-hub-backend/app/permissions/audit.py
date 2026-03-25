"""Аудит-логирование изменений разрешений."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.models.permission_audit_log import PermissionAuditLog

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


async def log_permission_change(
    db: AsyncSession,
    organization_id: int,
    actor_id: int,
    action: str,
    *,
    target_user_id: int | None = None,
    module_code: str | None = None,
    permission_code: str | None = None,
    details: dict | None = None,
) -> None:
    """Записать изменение разрешений в аудит-трейл."""
    log_entry = PermissionAuditLog(
        organization_id=organization_id,
        actor_id=actor_id,
        action=action,
        target_user_id=target_user_id,
        module_code=module_code,
        permission_code=permission_code,
        details=details,
    )
    db.add(log_entry)
    await db.flush()
