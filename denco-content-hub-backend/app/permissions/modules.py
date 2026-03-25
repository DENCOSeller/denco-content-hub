"""Декларации модулей Content Hub Backend.

Импорт этого модуля регистрирует все декларации в реестре.
Должен быть импортирован до вызова ``sync_module_registry()``.
"""

from __future__ import annotations

from app.permissions.registry import ModuleDeclaration, PermissionDecl, register_module

# ---------------------------------------------------------------------------
# Тарифные планы
# ---------------------------------------------------------------------------
_ALL_TIERS = ("free", "starter", "professional", "enterprise")
_PAID_TIERS = ("starter", "professional", "enterprise")

# ---------------------------------------------------------------------------
# Модуль: Content (Контент / Референсы)
# ---------------------------------------------------------------------------
_content = ModuleDeclaration(
    code="content",
    name="Content",
    icon="IconPencil",
    description="Content creation, sources and references",
    sort_order=10,
    permissions=(
        PermissionDecl(short_code="view", name="View content", sort_order=1),
        PermissionDecl(short_code="create", name="Create content", sort_order=2),
        PermissionDecl(short_code="edit", name="Edit content", sort_order=3),
        PermissionDecl(short_code="delete", name="Delete content", sort_order=4),
    ),
    default_roles={
        "owner": ["view", "create", "edit", "delete"],
        "admin": ["view", "create", "edit", "delete"],
        "member": ["view", "create", "edit"],
        "viewer": ["view"],
    },
    plan_tiers=_ALL_TIERS,
)

# ---------------------------------------------------------------------------
# Модуль: Library (Библиотека)
# ---------------------------------------------------------------------------
_library = ModuleDeclaration(
    code="library",
    name="Library",
    icon="IconBooks",
    description="Content library and media assets",
    sort_order=20,
    permissions=(
        PermissionDecl(short_code="view", name="View library", sort_order=1),
        PermissionDecl(short_code="manage", name="Manage library items", sort_order=2),
        PermissionDecl(short_code="publish", name="Publish from library", sort_order=3),
    ),
    default_roles={
        "owner": ["view", "manage", "publish"],
        "admin": ["view", "manage", "publish"],
        "member": ["view", "manage", "publish"],
        "viewer": ["view"],
    },
    plan_tiers=_ALL_TIERS,
)

# ---------------------------------------------------------------------------
# Модуль: Calendar (Контент-план)
# ---------------------------------------------------------------------------
_calendar = ModuleDeclaration(
    code="calendar",
    name="Calendar",
    icon="IconCalendar",
    description="Content calendar and scheduling",
    sort_order=30,
    permissions=(
        PermissionDecl(short_code="view", name="View calendar", sort_order=1),
        PermissionDecl(short_code="manage", name="Manage calendar", sort_order=2),
    ),
    default_roles={
        "owner": ["view", "manage"],
        "admin": ["view", "manage"],
        "member": ["view", "manage"],
        "viewer": ["view"],
    },
    plan_tiers=_ALL_TIERS,
)

# ---------------------------------------------------------------------------
# Модуль: Knowledge (Граф знаний)
# ---------------------------------------------------------------------------
_knowledge = ModuleDeclaration(
    code="knowledge",
    name="Knowledge Graph",
    icon="IconVectorTriangle",
    description="Knowledge graph and content strategy",
    sort_order=40,
    permissions=(
        PermissionDecl(short_code="view", name="View knowledge graph", sort_order=1),
        PermissionDecl(short_code="manage", name="Manage knowledge nodes", sort_order=2),
        PermissionDecl(short_code="admin", name="Administer knowledge module", sort_order=3),
    ),
    default_roles={
        "owner": ["view", "manage", "admin"],
        "admin": ["view", "manage", "admin"],
        "member": ["view", "manage"],
        "viewer": ["view"],
    },
    plan_tiers=_ALL_TIERS,
)

# ---------------------------------------------------------------------------
# Модуль: Competitors (Конкуренты)
# ---------------------------------------------------------------------------
_competitors = ModuleDeclaration(
    code="competitors",
    name="Competitors",
    icon="IconSpy",
    description="Competitor monitoring and analysis",
    sort_order=50,
    permissions=(
        PermissionDecl(short_code="view", name="View competitors", sort_order=1),
        PermissionDecl(short_code="manage", name="Manage competitors", sort_order=2),
    ),
    default_roles={
        "owner": ["view", "manage"],
        "admin": ["view", "manage"],
        "member": ["view"],
    },
    plan_tiers=_PAID_TIERS,
)

# ---------------------------------------------------------------------------
# Модуль: Trends (Тренды)
# ---------------------------------------------------------------------------
_trends = ModuleDeclaration(
    code="trends",
    name="Trends",
    icon="IconTrendingUp",
    description="Trend discovery and monitoring",
    sort_order=60,
    permissions=(
        PermissionDecl(short_code="view", name="View trends", sort_order=1),
        PermissionDecl(short_code="manage", name="Manage trend niches", sort_order=2),
    ),
    default_roles={
        "owner": ["view", "manage"],
        "admin": ["view", "manage"],
        "member": ["view"],
    },
    plan_tiers=_PAID_TIERS,
)

# ---------------------------------------------------------------------------
# Модуль: Analytics (Аналитика)
# ---------------------------------------------------------------------------
_analytics = ModuleDeclaration(
    code="analytics",
    name="Analytics",
    icon="IconChartBar",
    description="Content analytics and intelligence reports",
    sort_order=70,
    permissions=(
        PermissionDecl(short_code="view", name="View analytics", sort_order=1),
    ),
    default_roles={
        "owner": ["view"],
        "admin": ["view"],
        "member": ["view"],
    },
    plan_tiers=_PAID_TIERS,
)

# ---------------------------------------------------------------------------
# Модуль: Settings (Настройки — core, всегда включён)
# ---------------------------------------------------------------------------
_settings = ModuleDeclaration(
    code="settings",
    name="Settings",
    icon="IconSettings",
    description="Organization and workspace settings",
    is_core=True,
    sort_order=80,
    permissions=(
        PermissionDecl(short_code="view", name="View settings", sort_order=1),
        PermissionDecl(short_code="manage", name="Manage settings", sort_order=2),
    ),
    default_roles={
        "owner": ["view", "manage"],
        "admin": ["view", "manage"],
    },
    plan_tiers=_ALL_TIERS,
)

# ---------------------------------------------------------------------------
# Регистрация всех модулей
# ---------------------------------------------------------------------------
for _decl in (
    _content,
    _library,
    _calendar,
    _knowledge,
    _competitors,
    _trends,
    _analytics,
    _settings,
):
    register_module(_decl)
