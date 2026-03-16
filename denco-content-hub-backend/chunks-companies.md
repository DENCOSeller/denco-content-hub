# Chunks: Companies — пошаговая реализация

> Каждый chunk = 1-2 часа. Независимый. Тестируемый. Коммитится отдельно.
> Ссылки на дыры: `strategy-companies.md` секция 8.
>
> **КЛЮЧЕВОЕ ИЗМЕНЕНИЕ vs v1**: Chunk 1 включает service layer changes.
> Причина: NOT NULL FK в workspaces требует что service layer передаёт company_id
> при создании workspace. Разделять migration и service update = сломанное приложение.

---

## Chunk 1: Company model + migration + workspace integration (АТОМАРНЫЙ)

**Цель**: Таблица `companies` в БД. Все существующие workspaces привязаны к "DENCO". Создание workspace и регистрация работают. Тесты проходят.

**Почему большой chunk**: Добавление `company_id NOT NULL` в workspaces — атомарная операция. Если migration отдельно от service layer, то между chunks:
- `workspace_service.create_workspace()` → FAIL (no company_id)
- `workspace_service.create_personal_workspace()` → FAIL
- `auth_service.register()` → FAIL (calls create_personal_workspace)
- ВСЕ тесты → FAIL (conftest.py seed'ит через register)

**Файлы:**
| Действие | Файл |
|----------|------|
| Создать | `app/models/company.py` — `Company` model с `is_default` field |
| Создать | `app/utils/slugify.py` — перенос + расширение slugify (кириллица) |
| Изменить | `app/models/workspace.py` — `company_id` FK + relationship |
| Изменить | `app/models/__init__.py` — export `Company` |
| Изменить | `app/config.py` — `default_company_slug: str = "denco"` |
| Изменить | `app/services/workspace_service.py` — company_id при создании ws, slugify import, `_to_response` обновление |
| Изменить | `app/services/auth_service.py` — company_id для personal workspace |
| Изменить | `app/services/platform_service.py` — `_to_workspace_response` с company fields |
| Изменить | `app/schemas/workspace.py` — company_id + company_name в responses, company_id в create |
| Изменить | `app/schemas/platform.py` — company_id + company_name |
| Изменить | `app/repositories/workspace_repository.py` — `selectinload(Workspace.company)` |
| Изменить | `tests/conftest.py` — seed default company |
| Создать | Migration via `alembic revision --autogenerate` + **ручная доработка** |

---

### Детали: Company model

```python
class Company(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    is_default: Mapped[bool] = mapped_column(default=False, nullable=False)

    workspaces: Mapped[list["Workspace"]] = relationship(back_populates="company")
```

Partial unique index: `UNIQUE(slug) WHERE deleted_at IS NULL`

### Детали: Workspace model changes

```python
# Добавить в Workspace:
company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
company: Mapped["Company"] = relationship(back_populates="workspaces")
```

### Детали: slugify перенос

1. Создать `app/utils/slugify.py` с расширенной версией (кириллица)
2. В `workspace_service.py`: удалить локальный `slugify()` (строки 31-34), заменить на `from app.utils.slugify import slugify`

### Детали: workspace_service.py changes

```python
# 1. Import
from app.utils.slugify import slugify  # вместо локальной функции
from app.repositories.company_repository import CompanyRepository

# 2. __init__: добавить company_repo
self.company_repo = CompanyRepository(db)

# 3. create_workspace(): добавить company_id logic
async def create_workspace(self, user: User, data: WorkspaceCreate) -> WorkspaceResponse:
    if data.company_id:
        company = await self.company_repo.get_by_id(data.company_id)
        if company.deleted_at:
            raise NotFoundException("Company not found")
        company_id = company.id
    else:
        personal_ws = await self.workspace_repo.get_personal(user.id)
        if personal_ws:
            company_id = personal_ws.company_id
        else:
            default = await self.company_repo.get_by_slug(settings.default_company_slug)
            company_id = default.id

    slug = await self._generate_unique_slug(data.name)
    workspace = await self.workspace_repo.create(
        name=data.name, slug=slug, is_personal=False, company_id=company_id
    )
    # ... rest same

# 4. create_personal_workspace(): принимает company_id param
async def create_personal_workspace(self, user: User, company_id: int) -> Workspace:
    slug = await self._generate_unique_slug(f"{user.name}s-workspace")
    workspace = await self.workspace_repo.create(
        name=f"{user.name}'s Workspace", slug=slug, is_personal=True, company_id=company_id
    )
    # ... rest same

# 5. _to_response(): добавить company fields
@staticmethod
def _to_response(workspace: Workspace, role: WorkspaceRole) -> WorkspaceResponse:
    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        slug=workspace.slug,
        is_personal=workspace.is_personal,
        role=role,
        company_id=workspace.company_id,
        company_name=workspace.company.name,  # requires joinedload!
        created_at=workspace.created_at,
    )
```

**ВАЖНО**: `workspace.company.name` требует что Company загружен. Без `selectinload` → lazy load → ошибка в async context (async SQLAlchemy не поддерживает lazy load).

### Детали: auth_service.py changes

```python
# В register():
from app.repositories.company_repository import CompanyRepository

company_repo = CompanyRepository(self.db)
default_company = await company_repo.get_default()
# или: await company_repo.get_by_slug(settings.default_company_slug)

workspace_service = WorkspaceService(self.db)
await workspace_service.create_personal_workspace(user, company_id=default_company.id)
```

### Детали: platform_service.py changes

```python
# _to_workspace_response(): добавить company fields
async def _to_workspace_response(self, workspace) -> PlatformWorkspaceResponse:
    members_count = await self.workspace_repo.get_members_count(workspace.id)
    content_count = await self.workspace_repo.get_content_count(workspace.id)
    return PlatformWorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        slug=workspace.slug,
        is_personal=workspace.is_personal,
        company_id=workspace.company_id,
        company_name=workspace.company.name,  # requires joinedload!
        members_count=members_count,
        content_count=content_count,
        created_at=workspace.created_at,
    )
```

### Детали: workspace_repository.py changes

```python
from sqlalchemy.orm import selectinload

# Обновить ВСЕ queries что возвращают Workspace для API:

async def get_user_workspaces(self, user_id: int) -> list[Workspace]:
    query = (
        self._base_query()
        .options(selectinload(Workspace.company))  # NEW
        .join(WorkspaceMember, ...)
        .where(WorkspaceMember.user_id == user_id)
    )
    ...

async def get_by_id(self, entity_id: int) -> Workspace:
    # Override base to add selectinload
    query = (
        self._base_query()
        .options(selectinload(Workspace.company))
        .where(Workspace.id == entity_id)
    )
    ...

# Добавить метод:
async def get_personal(self, user_id: int) -> Workspace | None:
    query = (
        self._base_query()
        .join(WorkspaceMember, ...)
        .where(WorkspaceMember.user_id == user_id, Workspace.is_personal.is_(True))
    )
    result = await self.db.execute(query)
    return result.scalar_one_or_none()
```

### Детали: schemas changes

**workspace.py:**
```python
class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    company_id: int | None = None  # NEW

class WorkspaceResponse(BaseModel):
    id: int
    name: str
    slug: str
    is_personal: bool
    role: WorkspaceRole
    company_id: int       # NEW
    company_name: str     # NEW
    created_at: datetime
    model_config = {"from_attributes": True}
```

**platform.py — PlatformWorkspaceResponse:**
```python
# Добавить company_id: int и company_name: str
```

### Детали: tests/conftest.py changes

```python
@pytest.fixture(autouse=True)
async def _setup_db() -> AsyncGenerator[None]:
    """Create all tables before each test, drop after."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Seed default company (tests use create_all, not alembic)
    async with async_sessionmaker(engine, class_=AsyncSession)() as session:
        from app.models.company import Company
        session.add(Company(name="DENCO", slug="denco", is_default=True))
        await session.commit()
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
```

### Детали: Migration

```python
def upgrade():
    # 1. Create companies table (is_default field included)
    op.create_table("companies", ...)

    # 2. Seed DENCO (execute, НЕ bulk_insert — он не поддерживает func.now())
    conn = op.get_bind()
    conn.execute(sa.text(
        "INSERT INTO companies (name, slug, is_default, created_at, updated_at) "
        "VALUES ('DENCO', 'denco', true, now(), now())"
    ))
    result = conn.execute(sa.text("SELECT id FROM companies WHERE slug = 'denco'"))
    denco_id = result.scalar_one()

    # 3. Add company_id (nullable first)
    op.add_column("workspaces", sa.Column("company_id", sa.Integer, nullable=True))

    # 4. Backfill (parameterized query — НЕ f-string!)
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

    # 6. Partial unique index on slug
    op.create_index(
        "ix_companies_slug_active", "companies", ["slug"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
```

### Проверка

- `alembic upgrade head` без ошибок на dev и production БД
- `SELECT * FROM companies;` → DENCO с is_default=True
- `SELECT company_id FROM workspaces WHERE company_id IS NULL;` → 0 rows
- Регистрация нового юзера → personal workspace с company_id = DENCO
- Создание workspace → company_id заполнен
- `GET /workspaces` → каждый workspace содержит company_id и company_name
- `GET /platform/workspaces` → аналогично
- `pytest -v` → ВСЕ существующие тесты проходят
- `ruff check . && ruff format . && pyrefly check .`

**Коммит**: `feat(companies): add Company model, migration, and workspace integration`

---

## Chunk 2: Company schemas + repository

**Цель**: Data-access слой для Company CRUD. Без API, без изменений в поведении.

**Файлы:**
| Действие | Файл |
|----------|------|
| Создать | `app/schemas/company.py` — все схемы Company |
| Создать | `app/repositories/company_repository.py` — CRUD + статистика |

**Schemas:**
```python
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
    members_count: int
    content_count: int
```

**Repository методы:**
```python
class CompanyRepository:
    async def create(self, name, slug, is_default=False) -> Company
    async def get_by_id(self, company_id) -> Company  # raises NotFoundException
    async def get_by_slug(self, slug) -> Company | None
    async def get_default(self) -> Company  # WHERE is_default = True
    async def get_all(self, params, search?) -> PaginatedResponse[Company]
    async def update(self, company_id, **kwargs) -> Company
    async def soft_delete(self, company_id) -> None
    async def has_active_workspaces(self, company_id) -> bool
    async def get_detail_stats(self, company_id) -> dict
    async def slug_exists(self, slug, exclude_id?) -> bool
```

**Примечание**: Если `CompanyRepository` уже создан минимально в Chunk 1 (для `get_by_slug` / `get_default`), то здесь — расширение полным CRUD + stats.

**Проверка**: Импорт без ошибок. `ruff check . && pyrefly check .`

**Коммит**: `feat(companies): add Company schemas and repository`

---

## Chunk 3: Company service + CRUD API

**Цель**: Platform Owner может создавать, просматривать, редактировать, удалять компании. + фильтр по company в platform workspace list.

**Файлы:**
| Действие | Файл |
|----------|------|
| Создать | `app/services/company_service.py` — бизнес-логика |
| Создать | `app/api/companies.py` — 5 CRUD endpoints |
| Изменить | `app/api/router.py` — подключить company router |
| Изменить | `app/api/platform.py` — `company_id` query param в list workspaces |
| Изменить | `app/repositories/workspace_repository.py` — filter by company_id в `get_all_workspaces` |
| Изменить | `app/services/platform_service.py` — передать company_id |

**Service методы:**
```python
class CompanyService:
    async def create_company(self, data: CompanyCreate) -> CompanyResponse
        # 1. Generate slug from name (slugify)
        # 2. Check slug uniqueness, append suffix if needed (fix #9)
        # 3. Check total companies < 100 (MVP limit)
        # 4. Create (is_default=False)

    async def get_company(self, company_id: int) -> CompanyDetailResponse
        # 1. Get company or raise
        # 2. Get stats
        # 3. Return detail

    async def list_companies(self, params, search?) -> PaginatedResponse[CompanyResponse]

    async def update_company(self, company_id: int, data: CompanyUpdate) -> CompanyResponse
        # 1. Get or raise
        # 2. If name changed → regenerate slug, check uniqueness
        # 3. Update

    async def delete_company(self, company_id: int) -> None
        # 1. Get or raise
        # 2. Check is_default == False (fix #11)
        # 3. Check no active workspaces (fix #3)
        # 4. Soft delete
```

**Endpoints** (все под `require_platform_owner`):
```
GET    /api/v1/platform/companies                — список
POST   /api/v1/platform/companies                — создать (201)
GET    /api/v1/platform/companies/{company_id}    — детали + stats
PATCH  /api/v1/platform/companies/{company_id}    — обновить
DELETE /api/v1/platform/companies/{company_id}    — soft-delete (204)
```

**Platform workspace list filter:**
```python
# GET /api/v1/platform/workspaces?company_id=5
# Добавить optional query param company_id: int | None = None
# Передать в workspace_repository.get_all_workspaces()
```

**Проверка**:
- CRUD через curl/Swagger
- Обычный юзер → 403
- Delete DENCO (is_default) → 403
- Delete company с active workspaces → 403
- `GET /platform/workspaces?company_id=X` → фильтрация работает

**Коммит**: `feat(companies): add Company CRUD API for platform owners`

---

## Chunk 4: Frontend — Company store + API hooks + hey-api regenerate

**Цель**: Фронтенд-инфраструктура для компаний. Без UI изменений.

**Файлы:**
| Действие | Файл |
|----------|------|
| Регенерировать | `src/api/client/` — hey-api из обновлённого OpenAPI (после Chunks 1-3!) |
| Создать | `src/stores/company-store.ts` — Zustand store |
| Создать | `src/api/hooks/useCompanies.ts` — TanStack Query hooks |
| Изменить | `src/components/providers/AppProviders.tsx` — hydrate company store |

**Company store:**
```typescript
interface CompanyState {
  activeCompany: { id: number; name: string; slug: string } | null;
  setActiveCompany: (company: { id: number; name: string; slug: string }) => void;
  clearActiveCompany: () => void;
}
// Persist to cookie: active_company (30 days, like workspace store)
// Hydrate from cookie on app init
```

**Hooks** (enabled ТОЛЬКО если `is_platform_owner`, fix #15):
```typescript
useCompaniesQuery()         // GET /platform/companies (enabled: is_platform_owner)
useCompanyDetailQuery(id)   // GET /platform/companies/{id}
useCreateCompanyMutation()  // POST /platform/companies
useUpdateCompanyMutation()  // PATCH /platform/companies/{id}
useDeleteCompanyMutation()  // DELETE /platform/companies/{id}
```

**ВАЖНО**: hey-api regenerate нужен ПОСЛЕ Chunk 3 (когда все новые endpoints есть). Регенерация обновляет типы — `WorkspaceResponse` теперь содержит `company_id` и `company_name`.

**Проверка**: `npm run build` без ошибок. Hooks экспортируются. Types match.

**Коммит**: `feat(frontend): add company store and API hooks`

---

## Chunk 5: Frontend — Company Switcher в header

**Цель**: Platform Owner видит dropdown с компаниями в header. При переключении фильтруется список воркспейсов (client-side). Закрывает fix #13.

**Файлы:**
| Действие | Файл |
|----------|------|
| Создать | `src/components/features/company/CompanySwitcher.tsx` — dropdown component |
| Создать | `src/components/features/company/CompanySwitcher.module.css` — стили |
| Изменить | `src/app/(dashboard)/layout.tsx` — добавить CompanySwitcher в header |

**CompanySwitcher:**
```tsx
// Показывается ТОЛЬКО если user.is_platform_owner
// Select component (Mantine) с:
//   - "Все компании" (value: null)
//   - Список из useCompaniesQuery()
// При выборе → setActiveCompany(company) в store → cookie persist
```

**Фильтрация workspace list (client-side):**
```typescript
// В layout или sidebar:
const { activeCompany } = useCompanyStore();
const workspaces = useWorkspacesQuery();

const filteredWorkspaces = activeCompany
  ? workspaces.filter(ws => ws.company_id === activeCompany.id)
  : workspaces;
```

**Почему client-side**: `GET /workspaces` не имеет (и не должен иметь) query param `company_id` — он возвращает workspaces юзера по membership. У одного юзера обычно 5-20 workspaces — фильтрация на клиенте достаточна.

**Проверка:**
- Platform owner: видит dropdown, переключает → sidebar фильтруется
- Обычный юзер: НЕ видит dropdown
- Refresh → company из cookie (fix #13)

**Коммит**: `feat(frontend): add Company Switcher in header for platform owners`

---

## Chunk 6: Frontend — Company management page

**Цель**: Platform Owner может создавать, редактировать, удалять компании через UI.

**Файлы:**
| Действие | Файл |
|----------|------|
| Создать | `src/app/(dashboard)/companies/page.tsx` — страница управления |
| Создать | `src/app/(dashboard)/companies/companies.module.css` — стили |
| Изменить | `src/app/(dashboard)/layout.tsx` — навигация: ссылка "Companies" (platform owner only) |

**Защита route (fix #14):**
```tsx
// В начале page.tsx:
const { user } = useAuthStore();
const router = useRouter();

useEffect(() => {
  if (user && !user.is_platform_owner) {
    router.replace('/library');
  }
}, [user]);

if (!user?.is_platform_owner) return <LoadingState />;
```

**Страница управления:**
```
┌─────────────────────────────────────┐
│ Companies                    [+ Add]│
├─────────────────────────────────────┤
│ DENCO ⭐       3 ws  12 items  [...] │
│ Client Alpha   1 ws   5 items  [...] │
│ Client Beta    2 ws   8 items  [...] │
└─────────────────────────────────────┘
```

- DENCO помечен как default (нельзя удалить)
- Список с пагинацией и поиском
- Actions: Edit (modal), Delete (confirm, disabled для default)
- Add: modal с формой (name)

**Navigation:**
```tsx
{user?.is_platform_owner && (
  <NavLink href="/companies" icon={<IconBuilding />} label="Companies" />
)}
```

**Проверка:**
- Platform owner: видит ссылку, CRUD работает
- Delete DENCO → disabled / ошибка "Cannot delete default company"
- Delete company с workspaces → ошибка
- Обычный юзер: redirect с /companies

**Коммит**: `feat(frontend): add Company management page for platform owners`

---

## Порядок и зависимости

```
Chunk 1 (DB + migration + service integration)
    │
    ├── Chunk 2 (company schemas + full repository)
    │       │
    │       └── Chunk 3 (company service + CRUD API + platform filter)
    │               │
    │               ├── Chunk 4 (FE: hey-api regen + store + hooks)
    │               │       │
    │               │       ├── Chunk 5 (FE: CompanySwitcher)
    │               │       │
    │               │       └── Chunk 6 (FE: management page)
    │               │
    │               └── (Chunk 5 и 6 зависят от 4, но независимы друг от друга)
```

**Строго последовательно**: 1 → 2 → 3 → 4

**После Chunk 4** — Chunks 5 и 6 можно делать параллельно (разные файлы).

**Потенциально параллельно** (если два разработчика):
- Backend dev: Chunks 1 → 2 → 3
- Frontend dev: ждёт завершения Chunk 3, затем Chunks 4 → 5+6

---

## Контрольный список после всех chunks

### Backend
- [ ] `ruff check . && ruff format .`
- [ ] `pyrefly check .`
- [ ] `pytest -v --cov=app` — ВСЕ тесты проходят (включая старые!)
- [ ] Проверить OpenAPI schema — новые endpoints видны, WorkspaceResponse содержит company fields
- [ ] `alembic upgrade head` на чистой БД → DENCO создан, все таблицы ок
- [ ] `alembic upgrade head` на production БД → existing workspaces получили company_id
- [ ] `SELECT * FROM companies WHERE is_default;` → DENCO
- [ ] `SELECT count(*) FROM workspaces WHERE company_id IS NULL;` → 0
- [ ] Register нового юзера → personal workspace в DENCO
- [ ] Create workspace → company_id заполнен
- [ ] CRUD компаний через Swagger
- [ ] Delete DENCO → 403
- [ ] `GET /platform/workspaces?company_id=X` → фильтрация

### Frontend
- [ ] `npm run lint`
- [ ] `npm run build` (type check + build)
- [ ] hey-api regenerate client — types match backend
- [ ] Platform owner: Company Switcher работает, фильтрует sidebar
- [ ] Platform owner: Company management page — CRUD работает
- [ ] Platform owner: DENCO → не удаляется
- [ ] Обычный юзер: НЕ видит CompanySwitcher, НЕ видит nav "Companies"
- [ ] Обычный юзер: прямой переход /companies → redirect
- [ ] Refresh: company context сохраняется из cookie
