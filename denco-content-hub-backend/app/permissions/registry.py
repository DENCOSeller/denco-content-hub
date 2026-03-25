"""Реестр модулей в памяти.

Модули регистрируются при импорте через ``register_module``.
Реестр синхронизируется с БД при старте приложения.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class PermissionDecl:
    """Описание одного разрешения внутри модуля."""

    short_code: str
    name: str
    description: str = ""
    sort_order: int = 0


@dataclass(frozen=True, slots=True)
class ModuleDeclaration:
    """Полное описание модуля платформы."""

    code: str
    name: str
    icon: str = ""
    description: str = ""
    is_core: bool = False
    permissions: tuple[PermissionDecl, ...] = ()
    default_roles: dict[str, list[str]] = field(default_factory=dict)
    plan_tiers: tuple[str, ...] = ()
    sort_order: int = 0


# ---------------------------------------------------------------------------
# Глобальный реестр (заполняется при импорте app.permissions.modules)
# ---------------------------------------------------------------------------

_MODULE_REGISTRY: dict[str, ModuleDeclaration] = {}


def register_module(decl: ModuleDeclaration) -> None:
    """Зарегистрировать декларацию модуля. Бросает исключение при дубликате."""
    if decl.code in _MODULE_REGISTRY:
        msg = f"Module {decl.code!r} already registered"
        raise ValueError(msg)
    _MODULE_REGISTRY[decl.code] = decl


def get_all_modules() -> dict[str, ModuleDeclaration]:
    """Вернуть копию реестра."""
    return dict(_MODULE_REGISTRY)


def get_module(code: str) -> ModuleDeclaration | None:
    """Найти модуль по коду."""
    return _MODULE_REGISTRY.get(code)
