# Chunks — Sprint 1 Implementation

Каждый chunk — атомарная единица работы. Выполняются строго последовательно.
После каждого chunk: `ruff check . && ruff format .` + `pyrefly check .` + коммит.

---

## Chunk 1: Project scaffold

**Цель:** Пустой проект запускается, `docker-compose up` поднимает PostgreSQL + Redis + pgAdmin.

**Файлы:**
```
pyproject.toml
.gitignore
.env.example
.env                    (копия .env.example с реальными значениями, в .gitignore)
docker-compose.yml
Dockerfile
```

**Что делает:**
1. `pyproject.toml` — все зависимости (runtime + dev), секция `[tool.ruff]`, `[tool.pytest]`
2. `.gitignore` — Python стандартный + .env + __pycache__ + .venv
3. `.env.example` — все переменные с дефолтами для dev
4. `docker-compose.yml` — postgres:16-alpine (5432), redis:7-alpine (6379), pgadmin4 (5050)
5. `Dockerfile` — multi-stage, Python 3.13

**Проверка:** `docker-compose up -d` → postgres и redis доступны. `pip install -e ".[dev]"` без ошибок.

**Коммит:** `chore: init project scaffold with Docker and dependencies`

---

## Chunk 2: App core

**Цель:** `uvicorn app.main:app --reload` запускается, `GET /health` отвечает.

**Файлы:**
```
app/__init__.py
app/config.py
app/database.py
app/exceptions.py
app/logging_config.py
app/middleware.py
app/schemas/__init__.py
app/schemas/common.py
app/api/__init__.py
app/api/router.py
app/api/health.py
app/main.py
```

**Что делает:**
1. `config.py` — Settings(BaseSettings): database_url, redis_url, secret_key, algorithm, cors_origins, debug и пр.
2. `database.py` — async engine, async_session_factory, `get_db` dependency (rollback on exception)
3. `exceptions.py` — AppException, NotFoundException, ConflictException, ForbiddenException, UnauthorizedException, register_exception_handlers
4. `logging_config.py` — structlog configure (ConsoleRenderer в dev)
5. `middleware.py` — RequestIDMiddleware, LoggingMiddleware
6. `schemas/common.py` — PaginationParams, PaginatedResponse[T], ErrorResponse, HealthResponse
7. `api/health.py` — `GET /health` (проверяет DB `SELECT 1` + Redis `PING`)
8. `api/router.py` — api_router включает health
9. `main.py` — FastAPI app, lifespan, CORS, middleware, exception handlers, router

**Проверка:** `curl http://localhost:8000/health` → `{"status": "ok", "database": "ok", "redis": "ok"}`

**Коммит:** `feat(core): add app core with config, middleware, and health endpoint`

---

## Chunk 3: Base models + Alembic + BaseRepository

**Цель:** Alembic настроен, BaseRepository с flush-паттерном готов.

**Файлы:**
```
app/models/__init__.py
app/models/base.py
app/repositories/__init__.py
app/repositories/base.py
app/utils/__init__.py
app/utils/pagination.py
alembic.ini
migrations/env.py
migrations/script.py.mako
migrations/versions/              (пустая директория)
```

**Что делает:**
1. `models/base.py` — Base(DeclarativeBase), TimestampMixin, SoftDeleteMixin
2. `models/__init__.py` — реэкспорт (пока только Base)
3. `repositories/base.py` — BaseRepository[ModelType]:
   - **flush() вместо commit()** во всех методах (create, update, soft_delete)
   - `_base_query()` автоматически фильтрует `deleted_at IS NULL`
   - `get_by_id()`, `create()`, `update()`, `soft_delete()`
4. `utils/pagination.py` — хелпер `paginate(query, db, params) -> PaginatedResponse`
5. Alembic: async env.py с `run_async_migrations()`, target_metadata = Base.metadata

**Проверка:** `alembic check` работает без ошибок.

**Коммит:** `feat(core): add base models, repository with flush pattern, and Alembic`

---

## Chunk 4: User model + security utils

**Цель:** Модель User в БД, утилиты для JWT и паролей.

**Файлы:**
```
app/models/user.py
app/models/__init__.py            (обновить: реэкспорт User)
app/utils/security.py
app/schemas/auth.py
app/schemas/user.py
app/schemas/__init__.py
migrations/versions/001_add_users.py    (autogenerate)
```

**Что делает:**
1. `models/user.py` — User(Base, TimestampMixin, SoftDeleteMixin):
   - id, email, name, hashed_password, is_active
   - **Partial unique index:** `Index("ix_users_email_active", "email", unique=True, postgresql_where=text("deleted_at IS NULL"))`
   - НЕ `unique=True` на колонке
2. `utils/security.py` — hash_password, verify_password, create_access_token, create_refresh_token, decode_token
3. `schemas/auth.py` — RegisterRequest (email: EmailStr, password: str Field(min_length=8, max_length=128), name: str), LoginRequest, RefreshRequest, TokenResponse
   - Email нормализация: `@field_validator("email")` → `.lower().strip()`
4. `schemas/user.py` — UserResponse (id, email, name, is_active, created_at), UserUpdate
5. Миграция: `alembic revision --autogenerate -m "add users table"`
   - **Проверить миграцию руками:** partial unique index может не подхватиться autogenerate, добавить вручную

**Проверка:** `alembic upgrade head` → таблица users создана. `\d users` показывает partial unique index.

**Коммит:** `feat(auth): add User model, security utils, and auth schemas`

---

## Chunk 5: Auth (register/login/refresh/logout/me)

**Цель:** Полный auth flow работает через API.

**Файлы:**
```
app/repositories/user_repository.py
app/services/__init__.py
app/services/auth_service.py
app/dependencies.py
app/api/auth.py
app/api/users.py
app/api/router.py                  (обновить: подключить auth + users)
```

**Что делает:**
1. `repositories/user_repository.py` — UserRepository(BaseRepository[User]):
   - `get_by_email(email)` — query с фильтром email
2. `services/auth_service.py` — AuthService(db):
   - `register()` — проверка email → create user (flush) → commit → create tokens
   - `login()` — find by email → verify password → tokens. Если user не найден — dummy verify для защиты от timing attack
   - `refresh_tokens()` — decode → check blacklist в Redis → blacklist старый токен (rotation) → new tokens
   - `logout()` — blacklist refresh token в Redis (TTL = оставшееся время жизни)
3. `dependencies.py`:
   - `get_redis()` — async Redis connection (pool из lifespan)
   - `get_current_user()` — Bearer → decode → check type=access → find user → check is_active
4. `api/auth.py` — router prefix="/auth":
   - `POST /register` → 201 TokenResponse
   - `POST /login` → 200 TokenResponse
   - `POST /refresh` → 200 TokenResponse
   - `POST /logout` → 204 (requires auth)
5. `api/users.py` — router prefix="/users":
   - `GET /me` → 200 UserResponse (requires auth)
6. `main.py` — инициализация Redis pool в lifespan (startup: create pool, shutdown: close)

**Проверка:**
```bash
# Register
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test12345","name":"Test"}'
# → 201, returns tokens

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test12345"}'
# → 200, returns tokens

# Me
curl http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer <access_token>"
# → 200, returns user
```

**Коммит:** `feat(auth): add register, login, refresh, logout endpoints`

---

## Chunk 6: Auth tests

**Цель:** Тесты покрывают все auth-сценарии, включая edge cases.

**Файлы:**
```
tests/__init__.py
tests/conftest.py
tests/test_auth.py
tests/test_users.py
```

**Что делает:**
1. `conftest.py`:
   - Test DB: `{database_url}_test`
   - Override `get_db` с test session
   - Override `get_redis` с fakeredis (или test Redis index 1)
   - Fixtures: `client`, `db_session`, `auth_headers`, `registered_user`
2. `test_auth.py`:
   - `test_register_success` — 201, returns tokens
   - `test_register_duplicate_email` — 409
   - `test_register_weak_password` — 422 (< 8 chars)
   - `test_register_email_normalized` — `TEST@TEST.COM` → ищется как `test@test.com`
   - `test_login_success` — 200
   - `test_login_wrong_password` — 401
   - `test_login_nonexistent_email` — 401
   - `test_refresh_success` — 200, new tokens
   - `test_refresh_with_access_token` — 401 (wrong token type)
   - `test_refresh_rotation` — старый refresh token не работает после refresh
   - `test_logout_success` — 204
   - `test_logout_refresh_blacklisted` — refresh после logout → 401
3. `test_users.py`:
   - `test_get_me_success` — 200, correct user data
   - `test_get_me_unauthorized` — 403

**Проверка:** `pytest tests/test_auth.py tests/test_users.py -v` — все тесты зелёные.

**Коммит:** `test(auth): add auth and user endpoint tests`

---

## Chunk 7: Workspace + WorkspaceMember models

**Цель:** Модели в БД, enum ролей, partial unique indexes.

**Файлы:**
```
app/models/workspace.py
app/models/workspace_member.py
app/models/__init__.py             (обновить: реэкспорт Workspace, WorkspaceMember)
app/schemas/workspace.py
migrations/versions/002_add_workspaces.py  (autogenerate)
```

**Что делает:**
1. `models/workspace.py` — Workspace(Base, TimestampMixin, SoftDeleteMixin):
   - id, name, slug, is_personal
   - **Partial unique index:** `Index("ix_workspaces_slug_active", "slug", unique=True, postgresql_where=text("deleted_at IS NULL"))`
2. `models/workspace_member.py`:
   - WorkspaceRole(str, Enum): OWNER, ADMIN, EDITOR, VIEWER, CONTRACTOR
   - WorkspaceMember(Base, TimestampMixin): id, user_id (FK), workspace_id (FK), role
   - `UniqueConstraint("user_id", "workspace_id")`
   - Indexes: `workspace_id`, `user_id` для быстрых JOIN-ов
3. `schemas/workspace.py`:
   - WorkspaceCreate(name: str)
   - WorkspaceResponse(id, name, slug, is_personal, role, created_at)
   - WorkspaceUpdate(name: str | None)
   - WorkspaceMemberResponse(id, user_id, user_name, user_email, role, created_at)
   - AddMemberRequest(email: EmailStr, role: WorkspaceRole) — с валидатором: role != OWNER
   - UpdateMemberRoleRequest(role: WorkspaceRole) — с валидатором: role != OWNER
4. Миграция: autogenerate + проверить partial indexes вручную

**Проверка:** `alembic upgrade head` → таблицы workspaces, workspace_members созданы с правильными indexes.

**Коммит:** `feat(workspaces): add Workspace and WorkspaceMember models with schemas`

---

## Chunk 8: Workspace repositories + services

**Цель:** CRUD воркспейсов и управление участниками — бизнес-логика.

**Файлы:**
```
app/repositories/workspace_repository.py
app/repositories/workspace_member_repository.py
app/services/workspace_service.py
app/services/workspace_member_service.py
```

**Что делает:**
1. `repositories/workspace_repository.py` — WorkspaceRepository(BaseRepository[Workspace]):
   - `get_by_slug(slug)` — find by slug (active only)
   - `get_user_workspaces(user_id)` — JOIN members, filter workspace.deleted_at IS NULL
2. `repositories/workspace_member_repository.py` — WorkspaceMemberRepository(BaseRepository[WorkspaceMember]):
   - `get_membership(user_id, workspace_id)` → WorkspaceMember | None
   - `add_member(user_id, workspace_id, role)` → flush
   - `remove_member(member)` → delete + flush
   - `list_members(workspace_id, pagination)` → JOIN users, filter user.deleted_at IS NULL
3. `services/workspace_service.py` — WorkspaceService(db):
   - `create_workspace(user, data)` — slugify name → create ws (flush) → add owner member (flush) → commit
   - `create_personal_workspace(user)` — create ws + member, **flush only** (caller commits)
   - `get_user_workspaces(user)` → list[WorkspaceResponse]
   - `update_workspace(user, workspace_id, data)` — check membership owner/admin → update → commit
   - `delete_workspace(user, workspace_id)` — check owner, not personal → soft_delete → commit
4. `services/workspace_member_service.py` — WorkspaceMemberService(db):
   - `add_member(actor, workspace_id, data)` — check actor owner/admin → find user by email → check not already member → check role != OWNER → add → commit
   - `update_member_role(actor, workspace_id, member_id, data)` — check actor permission → check target not owner → check admin can't assign admin → update → commit
   - `remove_member(actor, workspace_id, member_id)` — check actor permission → check target not owner → delete → commit
   - `leave_workspace(user, workspace_id)` — check not owner → delete own membership → commit

**Коммит:** `feat(workspaces): add workspace and member repositories and services`

---

## Chunk 9: Workspace dependencies + router + register update

**Цель:** API воркспейсов работает. Регистрация создаёт персональный workspace.

**Файлы:**
```
app/dependencies.py                (обновить: add workspace deps)
app/api/workspaces.py
app/api/router.py                  (обновить: подключить workspaces)
app/services/auth_service.py       (обновить: add personal ws on register)
```

**Что делает:**
1. `dependencies.py` — добавить:
   - `get_workspace_from_path(workspace_id, user, db)` → (Workspace, WorkspaceMember) — из URL path
   - `require_role(*allowed_roles)` — dependency factory, проверяет member.role in allowed_roles → ForbiddenException
2. `api/workspaces.py` — router prefix="/workspaces":
   ```
   GET    /                          → list user's workspaces
   POST   /                          → 201, create workspace
   GET    /{workspace_id}            → workspace detail
   PATCH  /{workspace_id}            → update (owner/admin)
   DELETE /{workspace_id}            → soft delete (owner)
   GET    /{workspace_id}/members    → list members (paginated)
   POST   /{workspace_id}/members    → add member (owner/admin)
   PATCH  /{workspace_id}/members/{member_id}  → update role (owner/admin)
   DELETE /{workspace_id}/members/{member_id}  → remove member (owner/admin)
   POST   /{workspace_id}/members/leave        → leave workspace
   ```
3. `auth_service.py` — обновить `register()`:
   - После create user (flush): `workspace_service.create_personal_workspace(user)` (flush)
   - Один `commit()` в конце — атомарная транзакция

**Проверка:**
```bash
# Register (creates user + personal workspace)
curl -X POST .../auth/register -d '{"email":"test@test.com","password":"Test12345","name":"Test"}'

# List workspaces (should see personal workspace)
curl .../workspaces -H "Authorization: Bearer <token>"
# → [{"name": "Test's Workspace", "is_personal": true, "role": "owner"}]

# Create workspace
curl -X POST .../workspaces -H "Authorization: Bearer <token>" -d '{"name":"My Project"}'
# → 201
```

**Коммит:** `feat(workspaces): add workspace endpoints and auto-create personal workspace`

---

## Chunk 10: Workspace + member tests

**Цель:** Тесты покрывают все workspace и member сценарии.

**Файлы:**
```
tests/conftest.py                  (обновить: add workspace fixtures)
tests/test_workspaces.py
tests/test_members.py
```

**Что делает:**
1. `conftest.py` — добавить fixtures:
   - `workspace_headers` — auth headers + created non-personal workspace
   - `second_user_headers` — второй зарегистрированный пользователь
2. `test_workspaces.py`:
   - `test_register_creates_personal_workspace` — register → list workspaces → personal ws exists
   - `test_create_workspace` — 201, slug generated
   - `test_list_workspaces` — returns personal + created
   - `test_get_workspace_detail` — 200
   - `test_get_workspace_not_member` — 403 (or 404)
   - `test_update_workspace_owner` — 200
   - `test_update_workspace_viewer` — 403
   - `test_delete_workspace` — 204
   - `test_delete_personal_workspace` — 403
   - `test_delete_workspace_not_owner` — 403
3. `test_members.py`:
   - `test_add_member` — owner adds member → 201
   - `test_add_member_already_exists` — 409
   - `test_add_member_as_owner_role` — 422 (can't assign owner)
   - `test_add_member_editor_forbidden` — 403
   - `test_update_member_role` — owner changes role → 200
   - `test_update_owner_role` — 403 (can't change owner's role)
   - `test_admin_cannot_assign_admin` — 403
   - `test_remove_member` — 204
   - `test_remove_owner` — 403
   - `test_leave_workspace` — member leaves → 204
   - `test_owner_cannot_leave` — 403
   - `test_list_members_paginated` — returns paginated response

**Проверка:** `pytest tests/ -v --cov=app` — все тесты зелёные, coverage > 80%.

**Коммит:** `test(workspaces): add workspace and member management tests`

---

## Checklist — после всех chunks

```bash
# Всё работает?
docker-compose up -d
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Качество?
ruff check . && ruff format .
pyrefly check .

# Тесты?
pytest -v --cov=app

# Эндпоинты?
curl http://localhost:8000/health
curl http://localhost:8000/docs    # (debug=true)
```

**Итого: 10 chunks, 10 коммитов, ~35 файлов.**
