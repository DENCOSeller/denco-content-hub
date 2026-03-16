# Strategy: Companies (уровень над Workspace)

> Статус: ЧЕРНОВИК — ожидает утверждения архитектора
> Sprint: 5
> Зависимости: Sprint 4 (Workspaces & Teams) — ЗАВЕРШЁН

---

## Решения архитектора

| # | Вопрос | Решение |
|---|--------|---------|
| Q1 | Подход к Companies | **Вариант B** — таблица `companies`, `company_id` в `workspaces`, CRUD, UI переключение |
| Q2 | Миграция существующих данных | Все воркспейсы → автоматически в компанию "DENCO" |
| Q3 | Биллинг | НЕ делаем. Отложен на Sprint 7 |
| Q4 | Company Switcher | Только для Platform Owner (`is_platform_owner = true`), в хедере |
| Q5 | Company-level роли | НЕ делаем. Отложено на Sprint 6. Управление — только platform owner |
| Q6 | Personal workspaces | Принадлежат компании, в которой созданы. Миграция: все в "DENCO" |
| Q7 | Workspace creation company_id | Опционален. Default = компания personal workspace юзера |
| Q8 | Workspace slug scope | Остаётся глобально уникальным (как сейчас). Коллизия между компаниями — приемлемо для MVP |
| Q9 | Default company protection | DENCO нельзя удалить (is_default=True). Защита на уровне service |

---

## 1. Текущее состояние

| Что | Где | Статус |
|-----|-----|--------|
| Таблица `workspaces` (id, name, slug, is_personal) | `app/models/workspace.py` | ✅ |
| Workspace CRUD + members | `app/api/workspaces.py` | ✅ |
| Platform Owner API (`/platform/*`) | `app/api/platform.py` | ✅ |
| `is_platform_owner` boolean в users | `app/models/user.py` | ✅ |
| Контент привязан к workspace_id | `app/models/content_item.py` | ✅ |
| Приглашения в workspace | `app/api/invitations.py` | ✅ |
| `slugify()` функция | `app/services/workspace_service.py:31` | ✅ (базовая, без кириллицы) |
| `_to_response()` строит WorkspaceResponse вручную | `app/services/workspace_service.py:162` | ✅ |
| `_to_workspace_response()` строит PlatformWorkspaceResponse | `app/services/platform_service.py:80` | ✅ |
| Тесты используют `Base.metadata.create_all` (НЕ alembic) | `tests/conftest.py:26` | ⚠️ |
| `GET /workspaces` возвращает `list[WorkspaceResponse]` (НЕ paginated) | `app/api/workspaces.py:24` | ⚠️ |

**Вывод**: Нет понятия "компания". Все воркспейсы плоские. Нужно: таблица companies, FK в workspaces, CRUD API, фронт-переключатель.

**ВАЖНО**: Добавление `company_id NOT NULL` в workspaces — это **атомарная операция** с изменением service layer. Нельзя добавить FK в Chunk 1, а сервисы обновить в Chunk 4 — приложение сломается между чанками.

---

## 2. Целевая архитектура

### 2.1 Иерархия

```
Company (DENCO, ClientX, ClientY...)
├── Workspace A (team workspace)
│   ├── Members (OWNER, ADMIN, EDITOR...)
│   └── Content Items → Transcriptions
├── Workspace B (project workspace)
│   └── ...
└── Personal Workspace (user's personal)
    └── ...
```

### 2.2 Кто управляет компаниями

| Действие | Доступ |
|----------|--------|
| Создать компанию | Platform Owner |
| Редактировать компанию | Platform Owner |
| Удалить компанию (soft) | Platform Owner (кроме default) |
| Список компаний | Platform Owner |
| Переключаться между компаниями (UI) | Platform Owner |
| Видеть название компании в workspace | Все (read-only, информационно) |

**Обычные пользователи** НЕ видят Company Switcher. Для них компания — просто метаданные в workspace. Company-level роли — Sprint 6.

---

## 3. Изменения в БД

### 3.1 Новая таблица: `companies`

```python
class Company(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    is_default: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Relationships
    workspaces: Mapped[list["Workspace"]] = relationship(back_populates="company")
```

**Поле `is_default`**: Защищает дефолтную компанию от удаления. Устанавливается только через миграцию.

**Индексы:**
- `UNIQUE(slug) WHERE deleted_at IS NULL` — уникальный slug среди активных (как у workspaces)

**Mixins:** `TimestampMixin` + `SoftDeleteMixin`

### 3.2 Изменение таблицы: `workspaces`

```python
company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
company: Mapped["Company"] = relationship(back_populates="workspaces")
```

**Миграция (critical — 3-step data migration):**
```python
def upgrade():
    # 1. Create companies table
    op.create_table("companies", ...)

    # 2. Seed DENCO via execute (НЕ bulk_insert — он не поддерживает func.now())
    conn = op.get_bind()
    conn.execute(sa.text(
        "INSERT INTO companies (name, slug, is_default, created_at, updated_at) "
        "VALUES ('DENCO', 'denco', true, now(), now())"
    ))
    result = conn.execute(sa.text("SELECT id FROM companies WHERE slug = 'denco'"))
    denco_id = result.scalar_one()

    # 3. Add company_id (nullable first)
    op.add_column("workspaces", sa.Column("company_id", sa.Integer, nullable=True))

    # 4. Backfill (parameterized — НЕ f-string)
    conn.execute(
        sa.text("UPDATE workspaces SET company_id = :cid"),
        {"cid": denco_id},
    )

    # 5. Set NOT NULL + FK with ON DELETE RESTRICT
    op.alter_column("workspaces", "company_id", nullable=False)
    op.create_foreign_key(
        "fk_workspaces_company_id", "workspaces", "companies",
        ["company_id"], ["id"],
        ondelete="RESTRICT",
    )

    # 6. Indexes
    op.create_index(
        "ix_companies_slug_active", "companies", ["slug"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
```

### 3.3 Не трогаем

`users`, `workspace_members`, `workspace_invitations`, `content_items`, `transcriptions` — структура не меняется.

---

## 4. Новые API эндпоинты

### 4.1 Company CRUD (`/api/v1/platform/companies`)

Все эндпоинты требуют `is_platform_owner = True`.

| Method | Path | Описание | Response |
|--------|------|----------|----------|
| GET | `/` | Список компаний (пагинация, search) | `PaginatedResponse[CompanyResponse]` |
| POST | `/` | Создать компанию | `CompanyResponse` (201) |
| GET | `/{company_id}` | Детали компании (+ статистика) | `CompanyDetailResponse` |
| PATCH | `/{company_id}` | Обновить (name) | `CompanyResponse` |
| DELETE | `/{company_id}` | Soft-delete (403 если is_default) | 204 |

### 4.2 Изменения в существующих эндпоинтах

| Endpoint | Изменение |
|----------|-----------|
| `GET /api/v1/platform/workspaces` | + query param `company_id` для фильтрации |
| `POST /api/v1/workspaces` | + опциональное поле `company_id` в body |
| `GET /api/v1/workspaces` | + `company_id`, `company_name` в каждом response item |
| `GET /api/v1/workspaces/{id}` | + `company_id`, `company_name` в response |

**ВАЖНО**: `GET /api/v1/workspaces` **НЕ** получает query param `company_id`. Этот эндпоинт возвращает воркспейсы юзера (через membership). Фильтрация по компании для platform owner — через `GET /platform/workspaces?company_id=X` или client-side filter по полю `company_id` в response.

---

## 5. Schemas

### 5.1 Новые

```python
# app/schemas/company.py

class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

class CompanyUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)

class CompanyResponse(BaseModel):
    id: int
    name: str
    slug: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class CompanyDetailResponse(CompanyResponse):
    workspaces_count: int
    members_count: int  # уникальные юзеры через workspace_members
    content_count: int  # total content items
```

### 5.2 Изменённые

```python
# app/schemas/workspace.py — WorkspaceResponse

class WorkspaceResponse(BaseModel):
    id: int
    name: str
    slug: str
    is_personal: bool
    role: WorkspaceRole
    company_id: int            # NEW
    company_name: str          # NEW
    created_at: datetime
    model_config = {"from_attributes": True}

# app/schemas/workspace.py — WorkspaceCreate

class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    company_id: int | None = None  # Optional: platform owner can specify

# app/schemas/platform.py — PlatformWorkspaceResponse

class PlatformWorkspaceResponse(BaseModel):
    id: int
    name: str
    slug: str
    is_personal: bool
    company_id: int            # NEW
    company_name: str          # NEW
    members_count: int
    content_count: int
    created_at: datetime
```

---

## 6. Бизнес-логика

### 6.1 Создание компании

```python
# CompanyService.create()
1. Проверить: name не пустое
2. Сгенерировать slug из name (slugify)
3. Проверить уникальность slug (среди активных), append suffix если нужно
4. Check total companies < 100 (MVP limit)
5. Создать Company (is_default=False)
6. Return CompanyResponse
```

### 6.2 Удаление компании (soft)

```python
# CompanyService.delete()
1. Проверить: компания существует
2. Проверить: is_default == False → иначе ForbiddenException("Cannot delete default company")
3. Проверить: нет активных workspaces (deleted_at IS NULL)
   → Если есть — ForbiddenException("Cannot delete company with active workspaces")
4. Soft-delete (deleted_at = now())
```

**Решение**: НЕ каскадим удаление на воркспейсы. Сначала удали/перенеси воркспейсы, потом удаляй компанию. На уровне БД: `ON DELETE RESTRICT` как страховка.

### 6.3 Создание workspace → company_id

```python
# WorkspaceService.create_workspace()
1. Если company_id передан:
   - Проверить что компания существует и не удалена
   - Использовать
2. Если company_id НЕ передан:
   - Найти personal workspace юзера
   - Использовать его company_id
   - Если нет personal ws → использовать default company (by slug from config)
3. Создать workspace с company_id
```

### 6.4 Регистрация → personal workspace company_id

```python
# AuthService.register()
# Personal workspace всегда в default company (MVP).
# Логику "по invite" можно добавить позже.
1. Lookup default company by slug (config.default_company_slug)
2. Create personal workspace с company_id = default_company.id
```

### 6.5 `_to_response()` — обновление (5 точек!)

Добавление `company_id` и `company_name` в WorkspaceResponse ломает **5 мест** где response собирается вручную:

| Метод | Файл | Что ломается |
|-------|------|-------------|
| `_to_response()` | `workspace_service.py:162` | Нет company_id, company_name |
| `_to_workspace_response()` | `platform_service.py:80` | Нет company_id, company_name |
| `get_user_workspaces()` | `workspace_service.py:59` | N+1 при обращении к workspace.company (нет joinedload) |
| `get_workspace_detail()` | `workspace_service.py:68` | Тоже нет joinedload |
| `list_workspaces()` | `platform_service.py:40` | Тоже нет joinedload |

**Решение**: добавить `selectinload(Workspace.company)` во ВСЕ repository queries, обновить все `_to_response` методы.

---

## 7. Frontend изменения

### 7.1 Company Switcher (header, только Platform Owner)

```
┌──────────────────────────────────────────────────┐
│ [DENCO Logo]    [DENCO ▼]    [🏢]  [User ▼]    │
│                  ↑ company                       │
│                  switcher                        │
└──────────────────────────────────────────────────┘
```

- Select/dropdown с названиями компаний + "All companies"
- Показывается ТОЛЬКО если `user.is_platform_owner === true`
- При переключении → **client-side filter** по `company_id` из workspace responses
- Сохраняется в cookie (`active_company`)

**Почему client-side filter**: `GET /workspaces` возвращает все workspaces юзера без фильтрации по company. Добавлять server-side filter для этого эндпоинта избыточно — количество workspace'ов у одного юзера невелико. CompanySwitcher просто фильтрует массив на клиенте по `workspace.company_id`.

### 7.2 Новые файлы фронтенда

| Файл | Что |
|------|-----|
| `src/stores/company-store.ts` | Zustand store для active company |
| `src/api/hooks/useCompanies.ts` | Hooks для CRUD компаний |
| `src/components/features/company/CompanySwitcher.tsx` | Dropdown в header |
| `src/components/features/company/CompanySwitcher.module.css` | Стили |
| `src/app/(dashboard)/companies/page.tsx` | Страница управления компаниями (platform owner) |
| `src/app/(dashboard)/companies/companies.module.css` | Стили |

### 7.3 Изменяемые файлы фронтенда

| Файл | Что меняется |
|------|-------------|
| `src/app/(dashboard)/layout.tsx` | + CompanySwitcher в header (conditional), + nav link "Companies" (conditional) |
| `src/stores/workspace-store.ts` | + company context awareness (optional, для client-side filter) |
| `src/components/providers/AppProviders.tsx` | + company store hydration |
| `src/api/client/` | Regenerate (hey-api) после backend changes |

### 7.4 Workspace list → фильтрация

Для platform owner:
- Если company выбрана → client-side filter sidebar workspaces по `company_id`
- "All companies" → показать все

Для обычного юзера:
- Без изменений, видит свои воркспейсы (company_name как info, если нужно)

### 7.5 Защита /companies route

Страница `/companies` доступна только platform owner. Два варианта:
- **A**: Client-side guard в компоненте (если `!user.is_platform_owner → redirect /library`)
- **B**: Middleware rule

Для MVP: вариант A (client-side guard в page.tsx). Middleware усложняет — нужно декодить JWT на сервере.

---

## 8. Дыры и риски

### 8.1 КРИТИЧЕСКИЕ

| # | Дыра | Описание | Решение |
|---|------|----------|---------|
| 1 | Migration + service layer MUST be atomic | NOT NULL FK без изменений в service layer = app ломается. `create_workspace()`, `create_personal_workspace()`, `register()` падают | **Chunk 1 включает service changes.** Нельзя разделять migration и service update на разные chunks |
| 2 | Tests use `create_all`, not Alembic | `conftest.py:26` использует `Base.metadata.create_all`. Seed DENCO из migration не существует в тест-БД. Все тесты создающие workspaces — FAIL | Добавить fixture/helper в `conftest.py` что seed'ит default company после `create_all` |
| 3 | Cascade delete protection | Удаление компании с workspaces потеряет данные | Service: запретить. DB: `ON DELETE RESTRICT`. Поле `is_default` для защиты DENCO |

### 8.2 ВЫСОКИЕ

| # | Дыра | Описание | Решение |
|---|------|----------|---------|
| 4 | Breaking change: WorkspaceResponse | Добавление company_id/company_name ломает фронт | Фронт обновляется в том же спринте. Hey-api regenerate |
| 5 | 5 точек сборки response ломаются | `_to_response()` в workspace_service (2 места) и platform_service (3 места) не имеют company data | Обновить ВСЕ `_to_response` + добавить joinedload во все repo queries |
| 6 | `bulk_insert` не поддерживает `sa.func.now()` | Alembic `op.bulk_insert` ожидает литералы, не SQLAlchemy functions | Использовать `conn.execute(sa.text(...))` вместо `bulk_insert` |
| 7 | f-string в SQL миграции | `f"UPDATE workspaces SET company_id = {denco_id}"` нарушает правило "no f-strings in SQL" из CLAUDE.md | Parameterized query: `sa.text("...").bindparams(cid=denco_id)` |
| 8 | Missing ON DELETE RESTRICT в FK | `create_foreign_key` без `ondelete` parameter = ON DELETE NO ACTION по умолчанию | Добавить `ondelete="RESTRICT"` в FK |
| 9 | Slug collision при создании | Два юзера создают компанию с одинаковым name | Partial unique index + retry с суффиксом |
| 10 | Existing `slugify()` в workspace_service.py | Strategy предлагает новый `app/utils/slugify.py`, но `slugify()` уже есть в `workspace_service.py:31-34`. Дублирование | Переместить в `app/utils/slugify.py`, расширить (кириллица), импортировать в workspace_service |

### 8.3 СРЕДНИЕ

| # | Дыра | Описание | Решение |
|---|------|----------|---------|
| 11 | Default company deletion | Platform owner может удалить DENCO → новые регистрации ломаются | `is_default` field + service check |
| 12 | N+1 при workspace listing | `get_user_workspaces()` вызывает lazy load на `workspace.company` для каждого ws | `selectinload(Workspace.company)` в `get_user_workspaces()` query |
| 13 | CompanySwitcher state persistence | Refresh страницы сбрасывает выбранную компанию | Cookie `active_company` (как workspace store) |
| 14 | /companies page доступна всем | Authenticated user заходит на /companies, видит API errors | Client-side guard: redirect если !is_platform_owner |
| 15 | Frontend Company hooks call /platform endpoints | `useCompaniesQuery()` вызывает `GET /platform/companies`. Обычный юзер получит 403 | Hooks enabled ТОЛЬКО если `is_platform_owner`. Не вызывать для обычных юзеров |
| 16 | Workspace slug globally unique (cross-company) | Две компании не могут иметь workspace "marketing" | Приемлемо для MVP (Q8). Document decision. Fix в Sprint 6 если нужно |

### 8.4 Лимиты (hardcoded MVP)

| Лимит | Значение | Где |
|-------|----------|-----|
| Max companies | 100 | `CompanyService.create()` |
| Company name length | 1-255 chars | `CompanyCreate` schema |
| Company slug | auto-generated, 1-255 chars | `slugify()` |
| Default company | slug="denco", `is_default=True` | Migration + config |

---

## 9. Файлы, которые будут затронуты

### Новые файлы (Backend)

| Файл | Что |
|------|-----|
| `app/models/company.py` | Company model + relationship |
| `app/utils/slugify.py` | `slugify()` с транслитерацией кириллицы (перенос из workspace_service + расширение) |
| `app/schemas/company.py` | CompanyCreate, CompanyUpdate, CompanyResponse, CompanyDetailResponse |
| `app/repositories/company_repository.py` | Company DB access |
| `app/services/company_service.py` | Company business logic |
| `app/api/companies.py` | Company CRUD endpoints (under /platform) |
| `migrations/versions/xxx_add_companies.py` | Migration: companies table + company_id in workspaces |

### Изменяемые файлы (Backend)

| Файл | Что меняется |
|------|-------------|
| `app/models/workspace.py` | + `company_id` FK, + relationship to Company |
| `app/models/__init__.py` | + export Company |
| `app/schemas/workspace.py` | + `company_id`, `company_name` в responses, + `company_id` в WorkspaceCreate |
| `app/schemas/platform.py` | + `company_id`, `company_name` в PlatformWorkspaceResponse |
| `app/services/workspace_service.py` | + company_id при создании, + `_to_response` обновление, + перенос slugify в utils |
| `app/services/platform_service.py` | + `_to_workspace_response` обновление для company fields |
| `app/services/auth_service.py` | + company_id для personal workspace при register |
| `app/repositories/workspace_repository.py` | + selectinload(Company) в queries, + filter by company_id |
| `app/api/platform.py` | + company_id query param в list workspaces |
| `app/api/router.py` | + подключение companies router |
| `app/config.py` | + `default_company_slug` setting |
| `tests/conftest.py` | + seed default company после create_all |

### Новые файлы (Frontend)

| Файл | Что |
|------|-----|
| `src/stores/company-store.ts` | Zustand store: activeCompany, setActiveCompany, hydrate |
| `src/api/hooks/useCompanies.ts` | useCompaniesQuery, useCreateCompany, useUpdateCompany, useDeleteCompany |
| `src/components/features/company/CompanySwitcher.tsx` | Dropdown в header |
| `src/components/features/company/CompanySwitcher.module.css` | Стили |
| `src/app/(dashboard)/companies/page.tsx` | Company management page |
| `src/app/(dashboard)/companies/companies.module.css` | Стили |

### Изменяемые файлы (Frontend)

| Файл | Что меняется |
|------|-------------|
| `src/app/(dashboard)/layout.tsx` | + CompanySwitcher в header, + nav "Companies" (both conditional: is_platform_owner) |
| `src/components/providers/AppProviders.tsx` | + company store hydration |
| `src/api/client/` | Regenerate via hey-api |

### НЕ трогаем

| Файл | Почему |
|------|--------|
| `app/models/content_item.py` | Контент привязан к workspace, не к company |
| `app/models/transcription.py` | Нет связи с company |
| `app/api/content.py` | Workspace-scoped, не меняется |
| `app/api/transcription.py` | Workspace-scoped, не меняется |
| `app/api/invitations.py` | Workspace-scoped, не меняется |
| `app/models/invitation.py` | FK на workspace, не на company |
| `migrations/versions/*` | Protected (existing) |

---

## 10. Slugify утилита

**Текущее**: `slugify()` существует в `app/services/workspace_service.py:31-34` — базовая, без кириллицы.

**Действие**: Переместить в `app/utils/slugify.py`, расширить транслитерацией кириллицы. Импортировать в `workspace_service.py` и в `company_service.py`.

```python
# app/utils/slugify.py
import re
import unicodedata

_CYRILLIC_TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d",
    "е": "e", "ё": "yo", "ж": "zh", "з": "z", "и": "i",
    "й": "y", "к": "k", "л": "l", "м": "m", "н": "n",
    "о": "o", "п": "p", "р": "r", "с": "s", "т": "t",
    "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch",
    "ш": "sh", "щ": "shch", "ъ": "", "ы": "y", "ь": "",
    "э": "e", "ю": "yu", "я": "ya",
}

def slugify(text: str) -> str:
    """Generate URL-friendly slug from text. Supports cyrillic."""
    text = unicodedata.normalize("NFKD", text).lower()
    result = "".join(_CYRILLIC_TRANSLIT.get(c, c) for c in text)
    result = re.sub(r"[^a-z0-9]+", "-", result)
    return result.strip("-")[:255]
```

---

## 11. Итоговая оценка

| Метрика | Значение |
|---------|----------|
| Новых файлов (backend) | 7 (включая slugify.py) |
| Изменённых файлов (backend) | 12 (включая conftest.py) |
| Новых файлов (frontend) | 6 |
| Изменённых файлов (frontend) | 3 |
| Новых таблиц в БД | 1 (companies) |
| Новых полей в существующих таблицах | 1 (workspaces.company_id) |
| Новых API endpoints | 5 |
| Изменённых API endpoints | 4 |
| Breaking changes для фронта | 1 (WorkspaceResponse + company fields) |
| Закрытых дыр | 16 |
