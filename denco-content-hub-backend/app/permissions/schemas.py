"""Pydantic v2 схемы для API управления модулями и разрешениями."""

from __future__ import annotations

import datetime

from pydantic import BaseModel, ConfigDict


class ModuleResponse(BaseModel):
    """Ответ для одного модуля со статусом для организации."""

    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    icon: str | None = None
    description: str | None = None
    is_core: bool
    is_enabled: bool
    is_available: bool
    plan_required: str | None = None
    enabled_at: datetime.datetime | None = None
    permissions_count: int


class ModuleToggleRequest(BaseModel):
    """Запрос на включение/выключение модуля."""

    is_enabled: bool


class ModuleToggleResponse(BaseModel):
    """Ответ после переключения модуля."""

    code: str
    is_enabled: bool
    enabled_at: datetime.datetime | None = None


class PermissionDetailResponse(BaseModel):
    """Детали одного разрешения с источником."""

    code: str
    module: str
    name: str
    source: str
    granted: bool


class MyPermissionsResponse(BaseModel):
    """Разрешения текущего пользователя — для frontend PermissionProvider."""

    permissions: list[str]
    enabled_modules: list[str]
    role: str
    plan: str


class UserPermissionsResponse(BaseModel):
    """Все разрешения пользователя в организации."""

    user_id: int
    role: str
    permissions: list[PermissionDetailResponse]


class PermissionGrantRequest(BaseModel):
    """Одно назначение/отзыв разрешения."""

    permission_code: str
    granted: bool


class SetPermissionsRequest(BaseModel):
    """Массовое назначение разрешений."""

    grants: list[PermissionGrantRequest]


class EffectivePermissionsResponse(BaseModel):
    """Набор действующих кодов разрешений."""

    user_id: int
    permissions: list[str]


class RoleTemplateResponse(BaseModel):
    """Шаблон разрешений для системной роли."""

    role: str
    permissions: list[PermissionDetailResponse]


class AuditLogEntryResponse(BaseModel):
    """Запись аудит-лога разрешений."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    actor_id: int
    action: str
    target_user_id: int | None = None
    module_code: str | None = None
    permission_code: str | None = None
    details: dict | None = None
    created_at: datetime.datetime


class AuditLogListResponse(BaseModel):
    """Список записей аудит-лога."""

    items: list[AuditLogEntryResponse]
    total: int
