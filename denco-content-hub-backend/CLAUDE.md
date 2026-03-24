# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Следуй этим правилам ВСЕГДА, без исключений.

---

## Role

Senior Backend Developer: Python, FastAPI, PostgreSQL. Работаешь в паре с человеком-архитектором. НЕ принимаешь архитектурных решений самостоятельно — предложи варианты с плюсами/минусами и жди решения.

---

## Tech Stack (use ONLY these)

```
Python 3.13 | FastAPI (async) | PostgreSQL | SQLAlchemy 2.x (async) + Alembic
Pydantic v2 | ruff | pyrefly | JWT (python-jose) + passlib[bcrypt]
pytest + pytest-asyncio + httpx (AsyncClient) | structlog (JSON)
```

- ALL endpoints and DB functions: `async def`. Sync only for CPU-bound via `run_in_executor`.
- Do NOT suggest Django/Flask/SQLModel/MongoDB/SQLite.
- Verify library APIs exist in current versions before using them.

---

## Commands

```bash
docker-compose up -d                         # PostgreSQL + pgAdmin
uvicorn app.main:app --reload --port 8000    # Dev server
ruff check . && ruff format .                # Lint + format (run after EVERY change)
pyrefly check .                              # Type check
alembic revision --autogenerate -m "..."     # Create migration
alembic upgrade head                         # Apply migrations
pytest -v --cov=app                          # Run all tests
pytest tests/test_auth.py -v                 # Run single test file
pytest tests/test_auth.py::test_login -v     # Run single test
```

---

## Architecture

### Layer call order (strict)

```
Router (app/api/) → Service (app/services/) → Repository (app/repositories/) → DB
```

Routers: NO business logic, NO direct DB queries.
Services: throw `AppException` subclasses, NOT `HTTPException`.
Repositories: SQL via SQLAlchemy only, NO raw SQL strings.

### File placement

| What | Where | NOT here |
|------|-------|----------|
| SQLAlchemy model | `app/models/` | schemas, routers |
| Pydantic schema | `app/schemas/` | models |
| Endpoint | `app/api/` | services |
| Business logic | `app/services/` | routers, repositories |
| SQL queries | `app/repositories/` | services, routers |
| Settings | `app/config.py` | hardcoded |
| DB connection | `app/database.py` | main.py |
| Custom errors | `app/exceptions.py` | scattered |
| JWT/passwords | `app/utils/security.py` | services |
| Dependencies | `app/dependencies.py` | inside routers |

### Project structure

```
app/
├── main.py              # FastAPI app, lifespan, middleware, CORS
├── config.py            # Settings (Pydantic BaseSettings, reads .env)
├── database.py          # Engine, async session factory, get_db
├── dependencies.py      # Shared Depends (get_current_user, etc.)
├── exceptions.py        # AppException hierarchy + handlers
├── logging_config.py    # structlog config
├── middleware.py         # RequestID, Logging middleware
├── models/              # SQLAlchemy models (Mapped[] + mapped_column(), NOT Column())
│   ├── base.py          # Base, TimestampMixin, SoftDeleteMixin
│   └── ...
├── schemas/             # Pydantic v2 schemas
│   ├── common.py        # PaginatedResponse, PaginationParams, HealthResponse
│   └── ...
├── api/                 # Routers
│   ├── router.py        # Main router aggregator
│   └── ...
├── services/            # Business logic
├── repositories/        # DB access (BaseRepository with CRUD generics)
└── utils/
    ├── security.py      # hash_password, verify_password, create_*_token, decode_token
    └── pagination.py
migrations/              # Alembic
tests/                   # pytest-asyncio + httpx AsyncClient
```

---

## Key Patterns

### Config

`database_url` MUST start with `postgresql+asyncpg://`. Settings loaded from `.env` via `app/config.py`.

### Auth

- JWT access + refresh tokens. `HTTPBearer` scheme.
- Passwords: bcrypt only via `passlib.context.CryptContext`.
- `get_current_user` dependency in `app/dependencies.py` — validates access token, checks `is_active`.

### Exceptions

Use `NotFoundException`, `ConflictException`, `ForbiddenException`, `UnauthorizedException` from `app/exceptions.py`. Services must NOT use `HTTPException`.

### Pagination

All list endpoints return `PaginatedResponse[T]`: `{ items, total, page, size, pages }`.

### Logging

`structlog` only. No `print()`. NEVER log passwords/tokens.

```python
import structlog
logger = structlog.get_logger()
logger.info("User created", user_id=user.id)
```

### Models

SQLAlchemy 2.x declarative: `Mapped[]` + `mapped_column()`. NOT `Column()`.
Use `TimestampMixin` and `SoftDeleteMixin` from `app/models/base.py`.
Re-export all models in `app/models/__init__.py` (for Alembic).

### Tests

- Test DB: `{database_url}_test`
- `conftest.py` provides: `client` (AsyncClient), `db_session`, `auth_headers`
- All tests: `@pytest.mark.asyncio`, `async def`

### OpenAPI (critical for frontend)

Frontend uses **Hey-api** code generation from our OpenAPI schema.

- EVERY endpoint: `response_model`, `summary`, `tags`, `status_code`, `responses={404: ...}`
- Changing response schema = **breaking change** for frontend. WARN before changing.
- All routes under `/api/v1/`. Breaking changes → new version `/api/v2/`.

---

## Git Workflow
- **НИКОГДА** не коммитить напрямую в `main`, `dev` или `master`
- Для каждой задачи создавать ветку: `feat/<название>`, `fix/<название>`, `refactor/<название>`
- После завершения — `git push -u origin <ветка>`
- Merge в основную ветку делает только программист (человек), не агент
- PR создаётся через GitHub или Gitea

## Workflow

### Before coding

1. Explain plan briefly. List files. Wait for confirmation.
2. Check for existing similar code. Do NOT duplicate.
3. One task at a time.

### After coding

1. Run: `ruff check . && ruff format .`
2. Run: `pyrefly check .`
3. Report: files changed, what to verify, suggest commit message.

### Response pattern

- New task: `"Понял: [суть]. План: 1... 2... Файлы: [...]. Начинаю?"`
- Done: `"Готово: [файлы]. Проверь: [...]. Коммит: git add -A && git commit -m '...'"`

---

## Security (NEVER do these)

- No hardcoded secrets — only `.env` → `config.py`
- No plaintext passwords — only bcrypt
- No f-strings in SQL — only SQLAlchemy expressions
- No `hashed_password` in API responses
- No `allow_origins=["*"]` with `allow_credentials=True`
- No `eval()`, `exec()`, `pickle.loads()`

## Code Style

- Python 3.13: `|` union, `match/case`, f-strings
- Type hints on ALL functions
- Max **200 lines** per file
- `snake_case` functions/vars, `PascalCase` classes, `UPPER_SNAKE_CASE` constants

## Git Commits

```
feat(auth): add JWT refresh endpoint
fix(users): resolve duplicate email
refactor(db): extract base repository
test(orders): add integration tests
```

## Protected (do NOT modify/delete)

`.env`, `migrations/versions/*`, `.git/`

## Forbidden Commands

`rm -rf /`, `DROP DATABASE`, `TRUNCATE TABLE`, `alembic downgrade base`, `git push --force`, `docker-compose down -v`, `pip install` (explain first)

## Текущие задачи (Sprint 4 — Workspaces & Teams)

**Статус**: Chunk 1 ✅ DONE — миграция `1df12fc898d5` применена

| Chunk | Статус | Что |
|-------|--------|-----|
| 1 | ✅ DONE | `is_platform_owner` в users, `WorkspaceInvitation` model, migration |
| 2 | ✅ DONE | Platform owner read-only bypass в 3 точках авторизации + fix #9 |
| 3 | ✅ DONE | Platform API: `/platform/workspaces`, `/platform/users`, join |
| 4 | ✅ DONE | Transfer ownership endpoint |
| 5 | ✅ DONE | InvitationRepository + InvitationService (с SELECT FOR UPDATE) |
| 6 | ✅ DONE | Invitation API endpoints |
| 7 | ✅ DONE | Auto-accept при регистрации + cleanup при удалении workspace |

**Файлы плана**:
- `chunks-workspaces.md` — пошаговый план по файлам
- `strategy-workspaces.md` — архитектурные решения и список дыр (12 fixes)

**Sprint 4 ЗАВЕРШЁН** ✅ — все 7 chunks реализованы.

---

## Текущие задачи (Sprint 6 — Knowledge Graph)

| Chunk | Статус | Что |
|-------|--------|-----|
| 1 | ✅ DONE | Models + migration: KnowledgeNode, KnowledgeEdge, KnowledgeNodeVersion, CompanyMember |
| 2 | ✅ DONE | TipTap utility + Repositories (node, edge, version, company_member) |
| 3 | ✅ DONE | Schemas + KnowledgeService (CRUD + version tracking + edge validation) |
| 4 | ✅ DONE | CompanyMember service + dependency + company member endpoints |
| 5 | ✅ DONE | Workspace knowledge API (CRUD nodes, edges, graph, positions) |
| 6 | ✅ DONE | Company knowledge API |
| 7 | ✅ DONE | Tests |

**Chunk 1 детали**:
- `app/models/company_member.py` — CompanyMember + CompanyRole (OWNER/ADMIN/MEMBER)
- `app/models/knowledge.py` — KnowledgeNode, KnowledgeEdge, KnowledgeNodeVersion + enums
- 4 новые таблицы: `company_members`, `knowledge_nodes`, `knowledge_edges`, `knowledge_node_versions`
- CHECK constraint `ck_knowledge_nodes_scope` на scope, partial unique index `uq_ke_pair_label` на edges
- Миграция: `a449b211dd87`

**Chunk 2 детали**:
- `app/utils/tiptap.py` — конвертация TipTap JSON → plain text для AI
- `app/repositories/company_member_repository.py` — CRUD + is_admin_or_owner
- `app/repositories/knowledge_node_repository.py` — workspace/company nodes, graph, batch positions
- `app/repositories/knowledge_edge_repository.py` — edges for nodes, cascade soft-delete
- `app/repositories/knowledge_version_repository.py` — snapshot + version history

**Chunk 3 детали**:
- `app/schemas/knowledge.py` — 12 схем (CompanyMember, Node, Edge, Graph, Version, BatchPositions)
- `app/services/knowledge_service.py` — CRUD nodes/edges, graph, batch positions, version history, edge scope validation

**Chunk 4 детали**:
- `app/services/company_member_service.py` — CRUD + защита OWNER (actor_member из dependency)
- `app/api/company_members.py` — 4 эндпоинта `/companies/{id}/members` (GET/POST/PATCH/DELETE)
- `app/dependencies.py` — `get_company_member` (membership + platform owner bypass), `require_company_admin` (returns CompanyMember)

**Chunk 5 детали**:
- `app/api/knowledge.py` — 10 эндпоинтов `/workspaces/{id}/knowledge` (nodes CRUD, edges, graph, positions)
- `app/services/knowledge_service.py` — добавлен `get_workspace_nodes`
- `app/api/router.py` — подключён `knowledge_router`

**Chunk 6 детали**:
- `app/api/company_knowledge.py` — 10 эндпоинтов `/companies/{id}/knowledge` (nodes CRUD, edges, graph, positions)
- `app/services/knowledge_service.py` — добавлены `get_company_nodes`, `batch_update_company_positions`
- `app/repositories/knowledge_node_repository.py` — добавлен `batch_update_company_positions`
- `app/api/router.py` — подключён `company_knowledge_router`

**Chunk 7 детали**:
- `tests/test_knowledge.py` — 11 тестов (nodes CRUD, versions, edges, graph, positions)
- `tests/test_company_members.py` — 5 тестов (add, duplicate, update role, remove, can't remove owner)
- Фикс роутов: `/nodes/positions` перед `/nodes/{node_id}` в `knowledge.py` и `company_knowledge.py`

**Sprint 6 ЗАВЕРШЁН** ✅ — все 7 chunks реализованы.

### Sprint 6 итого: Knowledge Graph Foundation (бэкенд)
- 4 новые таблицы: `company_members`, `knowledge_nodes`, `knowledge_edges`, `knowledge_node_versions`
- Типы узлов: target_audience, meaning, channel, funnel, competitor, seo, brand, note
- Два уровня: Company knowledge + Workspace knowledge
- CompanyMember роли: OWNER/ADMIN/MEMBER
- TipTap JSON формат для rich text контента
- 20 API эндпоинтов (10 workspace + 10 company)
- Версионирование узлов (автоснапшоты при каждом изменении)
- 16 новых тестов pass, 83 существующих pass

**Следующий**: Sprint 7 — Knowledge Graph Frontend

---

## Текущие задачи (Sprint 7 — Knowledge Graph Frontend)

**Repo**: `denco-content-hub-frontend` (Next.js 15, React 19, Mantine UI, React Flow)

| Chunk | Статус | Что |
|-------|--------|-----|
| 1 | ✅ DONE | Зависимости + hey-api regen + useKnowledge hooks + knowledge-utils |
| 2 | ✅ DONE | Страница + React Flow canvas + useKnowledgeGraph + навигация + dark theme (POC gate) |
| 3 | ✅ DONE | Кастомные узлы (KnowledgeNodeCard) + кастомные edges + цвета/иконки |
| 4 | ✅ DONE | Toolbar + CreateNodeModal + фильтр по типу + поиск |
| 5 | ✅ DONE | NodeEditorDrawer + TipTap editor + save + delete + versions |
| 6 | ✅ DONE | Создание связей (onConnect → CreateEdgeModal) + удаление edges |
| 7 | ✅ DONE | Batch positions (debounce) + MiniMap + motion анимации |
| 8 | ✅ DONE | Company knowledge page (переиспользует все компоненты) |
| 9 | ✅ DONE | NodeListView + responsive (мобильная = список) |

**Sprint 7 ЗАВЕРШЁН** ✅ — все 9 chunks реализованы.

**Chunk 8 детали**:
- `src/api/hooks/useCompanyKnowledge.ts` — 10 хуков для company knowledge API
- `src/components/knowledge/KnowledgeGraph.tsx` — scope/scopeId props, scope routing
- `src/app/(dashboard)/companies/[id]/knowledge/page.tsx` — company knowledge graph page

**Chunk 9 детали**:
- `src/components/knowledge/NodeListView.tsx` — мобильный список карточек с фильтром/поиском
- `src/components/knowledge/KnowledgeGraph.tsx` — useMediaQuery адаптивное переключение граф/список

### Sprint 7 итого: Knowledge Graph Frontend
- 9 чанков, React Flow граф + TipTap редактор + мобильная версия
- Company + Workspace графы, версионирование, drag & drop, анимации
- Все риски (React 19 + React Flow, TipTap strict mode) решены

**Следующий**: Sprint 8 — AI Chat Assistant

---

## Sprint 8 — Global AI Assistant ✅ ЗАВЕРШЁН

### Бэкенд (4 chunks)

| Chunk | Что |
|-------|-----|
| 1 | Models (ChatSession, ChatMessage, AiSetting) + migration + config defaults |
| 2 | Repository + Schemas + Settings Service |
| 3 | Chat Service + AI Providers + SSE endpoint + Settings API |
| 4 | Tests (10 тестов) |

- 4 новые таблицы: `chat_sessions`, `chat_messages`, `ai_settings`, `chat_attachments`
- SSE стриминг через Anthropic API, knowledge graph context injection
- Tool use: `create_node`, `update_node`, `create_edge` (propose → confirm → apply)
- File attachments: PDF, images, DOCX → multi-content блоки для Anthropic
- Rate limiting, AI settings (DB override → config fallback)
- 8 API эндпоинтов (chat SSE, sessions CRUD, settings, attachments)
- Миграции: `affe9cdc3d54`, `4f2217bc5094`

### Фронтенд (8 chunks)

| Chunk | Что |
|-------|-----|
| 5 | Node References — парсер + кликабельные badges в чате |
| 6 | AI Actions — tool_use propose → confirm → apply knowledge graph changes |
| 7 | File attachments — загрузка файлов в чат (PDF, изображения, DOCX) |
| 8 | Polish: drag-drop, keyboard shortcuts, FAB, node AI tab, typing indicator |

- AI панель: SSE стриминг чат, session management, context-aware
- Node references — кликабельные inline badges → навигация к графу
- AI Actions — propose/confirm/apply изменений в граф знаний
- File attachments — до 3 файлов, 10MB, drag & drop
- Keyboard shortcuts: Cmd+Shift+I toggle, Escape close
- Mobile: FAB кнопка + fullscreen Drawer
- AI вкладка в NodeEditorDrawer — мини-чат про конкретный узел
- Typing indicator с gradient glow

---

## Sprint 12 — Content Intelligence (Unified Analyzer)

### Суть
Объединение дублированных AI-анализаторов References и Competitors в единый Content Intelligence пайплайн.
Было: отдельные `analysis_service.py` + `competitor/ai_analyzer.py` с дублированием логики.
Стало: единый `UnifiedAnalyzer` с динамическим выбором секций по `source_type`.

### Новые файлы
- `app/integrations/content_intelligence/` — analyzer, schemas, config (единая точка входа)
- `app/models/content_intelligence.py` — полиморфная модель (content_item_id OR competitor_post_id)
- `app/services/intelligence_service.py` — единый сервис
- `app/worker/tasks/intelligence_pipeline.py` — Celery tasks (on-demand + batch)
- `migrations/versions/c3d4e5f6a7b8_migrate_data_to_content_intelligence.py` — миграция данных

### Удалённые файлы (старый код)
- `app/api/analysis.py`, `app/services/analysis_service.py`, `app/repositories/analysis_repository.py`
- `app/models/content_analysis.py`, `app/schemas/content_analysis.py`
- `app/worker/tasks/analyze_content.py`, `app/worker/tasks/competitor_analysis.py`
- `app/integrations/competitor/ai_analyzer.py`

### Feature flag
- `USE_NEW_INTELLIGENCE=true` в config — переключает References и Competitors на unified analyzer

### Коммит
- `91301c0` — feat(intelligence): unified Content Intelligence для References и Competitors
- 87 файлов, +1279/-2728 строк (net -1449)

---

## Sprint 13 — Trend Discovery (Обнаружение трендов)

### Суть
Модуль обнаружения и мониторинга трендов по нишам. Автоматический поиск трендовых видео на YouTube и Instagram, расчёт viral score, мониторинг динамики, алерты.

### Новые таблицы
- `trend_niches` — ниши для мониторинга (keywords, platforms, monitoring_interval)
- `trend_items` — обнаруженные тренды (platform, metrics, viral_score, stage)
- `trend_snapshots` — история метрик (velocity, viral_score во времени)
- `trend_alerts` — уведомления о трендах (alert_type, threshold_triggered)
- `trend_alert_settings` — настройки порогов алертов per workspace
- Миграции: `ee855b0184e8`, `8ae1731bf9f0`, `0427f58ba939`

### Новые файлы
- `app/models/trend.py` — 5 моделей (TrendNiche, TrendItem, TrendSnapshot, TrendAlert, TrendAlertSettings)
- `app/schemas/trend.py` — Pydantic схемы для всех CRUD операций
- `app/repositories/trend_repository.py` — 5 репозиториев (Niche, Item, Snapshot, Alert, AlertSettings)
- `app/services/trend_scorer.py` — алгоритм расчёта viral_score, velocity, acceleration, стадии
- `app/services/trend_service.py` — TrendDiscoveryService (CRUD ниш, обнаружение, мониторинг, алерты)
- `app/integrations/trend_discovery/youtube_trends.py` — YouTube Data API интеграция
- `app/integrations/trend_discovery/instagram_trends.py` — Apify Instagram Reels интеграция
- `app/worker/tasks/trend_discovery.py` — 4 Celery Beat задачи + 2 Intelligence задачи
- `app/api/trends.py` — 15 REST API эндпоинтов

### Изменённые файлы
- `app/models/content_intelligence.py` — добавлен `trend_item_id` FK
- `app/services/intelligence_service.py` — добавлен `generate_trend_item_intelligence()`
- `app/worker/tasks/intelligence_pipeline.py` — добавлены trend intelligence tasks
- `app/api/intelligence.py` — добавлен `trend_router` (GET/POST trend intelligence)
- `app/api/router.py` — подключены trend_router, trend_intelligence_router
- `app/worker/celery_app.py` — зарегистрированы trend_discovery tasks в Beat schedule

### API эндпоинты
```
GET/POST   /workspaces/{id}/trends/niches       — список/создание ниш
GET/PATCH/DELETE /workspaces/{id}/trends/niches/{niche_id}
GET        /workspaces/{id}/trends               — список трендов (фильтры)
GET        /workspaces/{id}/trends/{trend_id}    — детали тренда
GET        /workspaces/{id}/trends/{trend_id}/snapshots — история метрик
POST       /workspaces/{id}/trends/{trend_id}/analyze   — Intelligence анализ
GET        /workspaces/{id}/trends/alerts        — список алертов
PATCH      /workspaces/{id}/trends/alerts/{id}/read     — отметить прочитанным
POST       /workspaces/{id}/trends/alerts/mark-all-read
GET/PUT    /workspaces/{id}/trends/alerts/settings      — настройки порогов
POST       /workspaces/{id}/trends/discover-now         — ручной запуск
```

### Celery Beat задачи
- `discover_trends_batch` — каждые 2 часа, обход активных ниш
- `monitor_trend_snapshots` — каждые 4 часа, обновление метрик
- `check_trend_alerts` — каждый час, проверка порогов
- `cleanup_old_trends` — раз в день, архивация старых трендов

### Коммит
- `ff6392a` — feat: Trend Discovery

### Известные ограничения (backlog)
- Дублирование scoring логики sync/async (Celery vs Service)
- N+1 в update_trend_snapshots при большом кол-ве трендов
- discover_trends_batch без fan-out (все ниши в одном таске)
- YouTube API quota без глобального трекинга

---

## Deployment (Sprint 2 completed)

- **Server**: `155.212.190.58`, systemd services: `denco-backend.service`, `denco-celery.service`
- **Domain**: `marketing.denco.store` with SSL (Let's Encrypt)
- **Backend**: uvicorn on port 8001 behind nginx reverse proxy
- **Celery**: worker with Redis broker (`redis://localhost:6379/1`)

## CORS

- Dev: `cors_origins = ["http://localhost:3000"]`
- Prod: `["https://marketing.denco.store", "http://155.212.190.58"]`. NEVER `["*"]` with credentials.

---

## Post-Sprint 8 Bug Fixes (2026-03-13)

| Fix | Файл | Проблема |
|-----|------|----------|
| fix(ai): pass API key explicitly to Anthropic client | `app/services/chat_service.py` | `AsyncAnthropic()` без `api_key` — systemd не загружает `.env`, Pydantic загружает, но SDK не видит |
| fix(ai): fix role serialization in chat history | `app/services/chat_service.py` | `msg.role.value` падал — StrEnum из БД возвращается как str, `.value` не нужен → `str(msg.role)` |
| fix(knowledge): fix synthetic member creation | `app/dependencies.py` | `CompanyMember.__new__()` не создаёт `_sa_instance_state` → `AttributeError`. Фикс: обычный конструктор + `make_transient()` |
| fix(knowledge): platform owner bypass in require_company_admin | `app/dependencies.py` | `require_company_admin` не пускал platform owner — не было bypass как в `get_company_member` |

---

## Sprint 10 — Universal Source Processor (вкладка Референсы)

### Суть
Универсальный процессор источников контента во вкладке References. Пользователь добавляет источник (YouTube видео, PDF файл, веб-страница, ручной текст) → система извлекает контент → AI анализирует → пользователь общается с контентом через чат.

### Типы источников (SourceType enum)
- `youtube_video` — транскрипция через Whisper / субтитры
- `pdf_file` — извлечение текста из PDF
- `web_page` — парсинг веб-страницы
- `manual_text` — ручной ввод текста

### Новые таблицы
- `content_analyses` — результат AI-анализа источника (summary, key_points, tags, status)
- `content_chat_messages` — сообщения чата с контентом (role, content, content_id)

### Новые API эндпоинты
- `POST /api/v1/content/source` — добавление нового источника
- `GET /api/v1/content/{id}/analysis` — получение анализа контента
- `POST /api/v1/content/{id}/chat` — чат с контентом

### Plugin-архитектура адаптеров
```
app/integrations/sources/
├── base.py              # BaseSourceAdapter (абстрактный класс)
├── youtube_adapter.py   # YouTubeSourceAdapter
├── pdf_adapter.py       # PDFSourceAdapter
├── web_adapter.py       # WebSourceAdapter
├── text_adapter.py      # TextSourceAdapter
└── registry.py          # SourceAdapterRegistry (фабрика по SourceType)
```

Каждый адаптер реализует `extract(source_url_or_data) → ExtractedContent` с единым интерфейсом.

---

## Sprint 11 — Контент-план (Планировщик публикаций)

### Суть
Новый раздел "Контент-план" — планировщик публикаций готового контента из Библиотеки.
Третье звено воронки: Референсы → Библиотека → **Контент-план**.

### Новая таблица
- `content_plan_items` — элемент контент-плана (workspace_id, library_item_id, scheduled_at, published_at, assignee_id, status, platform, metrics JSONB, notes, soft delete)
- Миграции: `e33d870558be` (create table), `a82ad052df80` (add notes)

### LibraryStatus расширен
- Добавлен `SCHEDULED` в enum `LibraryStatus` (Python StrEnum, хранится как VARCHAR)

### Новые файлы
- `app/models/content_plan_item.py` — модель ContentPlanItem
- `app/schemas/content_plan.py` — Pydantic схемы (Create, Update, Response, Filters)
- `app/repositories/content_plan_repository.py` — CRUD + фильтры по дате/статусу/платформе/assignee
- `app/services/content_plan_service.py` — бизнес-логика, синхронизация статусов Library↔Plan, валидация assignee
- `app/api/content_plan.py` — 7 эндпоинтов

### API эндпоинты
```
GET    /workspaces/{id}/content-plan                    — список (фильтры: date_from, date_to, status, platform, assignee_id)
GET    /workspaces/{id}/content-plan/{item_id}          — одна запись
POST   /workspaces/{id}/content-plan                    — создать
PATCH  /workspaces/{id}/content-plan/{item_id}          — обновить
DELETE /workspaces/{id}/content-plan/{item_id}          — soft delete
PATCH  /workspaces/{id}/content-plan/{item_id}/publish  — отметить как опубликовано
PATCH  /workspaces/{id}/content-plan/{item_id}/metrics  — обновить метрики
```

### Синхронизация статусов Library ↔ Plan
- Создание plan_item → library_item.status = 'scheduled'
- Удаление/отмена plan_item → library_item.status = 'ready'
- Публикация plan_item → library_item.status = 'published' + published_at
