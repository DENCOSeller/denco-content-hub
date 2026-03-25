"""Модели системы модульных разрешений.

Таблицы:
- module_registry: каталог модулей платформы
- module_permission: гранулярные разрешения внутри модулей
- plan_module_access: доступ модулей по тарифным планам
- org_module_config: настройка модулей для организации
- user_permission_grant: персональные переопределения разрешений
- role_permission_template: шаблоны разрешений для системных ролей
"""

from __future__ import annotations

import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ModuleRegistry(Base):
    """Каталог модулей платформы."""

    __tablename__ = "module_registry"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_core: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )


class ModulePermission(Base):
    """Гранулярное разрешение внутри модуля."""

    __tablename__ = "module_permission"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    module_id: Mapped[int] = mapped_column(
        ForeignKey("module_registry.id", ondelete="CASCADE"), nullable=False,
    )
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    short_code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("module_id", "short_code", name="uq_module_permission_module_short_code"),
        Index("ix_module_permission_module_id", "module_id"),
        Index("ix_module_permission_code", "code"),
    )


class PlanModuleAccess(Base):
    """Связь тарифных планов с доступными модулями."""

    __tablename__ = "plan_module_access"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    plan_tier: Mapped[str] = mapped_column(String(20), nullable=False)
    module_id: Mapped[int] = mapped_column(
        ForeignKey("module_registry.id", ondelete="CASCADE"), nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("plan_tier", "module_id", name="uq_plan_module_access_tier_module"),
        Index("ix_plan_module_access_plan_tier", "plan_tier"),
    )


class OrgModuleConfig(Base):
    """Настройка включения/выключения модулей для организации."""

    __tablename__ = "org_module_config"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False,
    )
    module_id: Mapped[int] = mapped_column(
        ForeignKey("module_registry.id", ondelete="CASCADE"), nullable=False,
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enabled_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    enabled_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True,
    )
    disabled_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    disabled_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "module_id", name="uq_org_module_config_org_module"),
        Index("ix_org_module_config_organization_id", "organization_id"),
    )


class UserPermissionGrant(Base):
    """Персональные переопределения разрешений."""

    __tablename__ = "user_permission_grant"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    permission_id: Mapped[int] = mapped_column(
        ForeignKey("module_permission.id", ondelete="CASCADE"), nullable=False,
    )
    granted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    granted_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "organization_id", "user_id", "permission_id",
            name="uq_user_permission_grant_org_user_perm",
        ),
        Index("ix_user_permission_grant_org_user", "organization_id", "user_id"),
        Index("ix_user_permission_grant_permission_id", "permission_id"),
    )


class RolePermissionTemplate(Base):
    """Шаблон разрешений по умолчанию для системных ролей."""

    __tablename__ = "role_permission_template"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    role: Mapped[str] = mapped_column(String(100), nullable=False)
    permission_id: Mapped[int] = mapped_column(
        ForeignKey("module_permission.id", ondelete="CASCADE"), nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("role", "permission_id", name="uq_role_permission_template_role_perm"),
        Index("ix_role_permission_template_role", "role"),
    )
