# Changelog

История спринтов, реконструированная из git log и стратегических файлов.

---

## Sprint 7 — Workspace-scoped Content & Settings (завершён)

**Цель**: Перенос библиотеки и настроек внутрь воркспейса. Ребрендинг "Библиотека" → "Референсы". Старые роуты → redirect.

### Chunk 1 ✅ DONE

**Утилиты и вынос компонентов**

- Создан `src/lib/utils/youtube.ts` — вынесены `extractYouTubeVideoId`, `formatDuration`, `formatTimecode` (дублировались в `library/page.tsx` и `library/[id]/page.tsx`)
- Создан `src/components/features/references/ContentRow.tsx` — компонент строки контента, принимает `basePath` prop для гибкого формирования href (`${basePath}/${item.id}` вместо захардкоженного `/library/${item.id}`)
- Создан `src/components/features/references/ContentRow.module.css` — стили `contentCard`, `thumbnail`, `videoId` (вынесены из `library.module.css`)
- Создан `src/components/features/settings/constants.ts` — `roleLabelMap`, `roleColorMap`, `inviteSchema`, `InviteFormValues`
- Создан `src/components/features/settings/TeamTab.tsx` — таб "Команда": форма приглашения + список участников (вынесен из `settings/page.tsx`)
- Создан `src/components/features/settings/InvitationsTab.tsx` — таб "Приглашения": список pending инвайтов с отменой (вынесен из `settings/page.tsx`)
- `sectionTitle` стиль реализован через Mantine props вместо импорта `dashboard.module.css`
- Старые файлы (`library/page.tsx`, `library/[id]/page.tsx`, `settings/page.tsx`) не затронуты

### Chunk 2 ✅ DONE

**Полные референсы внутри воркспейса**

- Создан `src/app/(dashboard)/workspaces/[id]/references/page.tsx` — список контента workspace-scoped: `workspaceId` из `useParams().id` (не из стора), breadcrumbs (company → workspace → Референсы), использует `ContentRow` с `basePath`, фильтры по статусу, поиск, пагинация через URL searchParams
- Создан `src/app/(dashboard)/workspaces/[id]/references/references.module.css` — стили страницы-списка (`pageTitle`, `addForm`, `sectionTitle`)
- Создан `src/app/(dashboard)/workspaces/[id]/references/[contentId]/page.tsx` — детальная страница контента: `workspaceId` из `params.id`, `contentId` из `params.contentId`, кнопка "Назад" → `/workspaces/${wsId}/references`, breadcrumbs (company → workspace → Референсы → Детали), YouTube embed, транскрипция с группировкой по спикерам, таймкоды с seekTo
- Создан `src/app/(dashboard)/workspaces/[id]/references/[contentId]/content-detail.module.css` — стили детальной страницы (3-колоночный grid layout, player, segments, speaker grouping)
- Удалён `src/app/(dashboard)/workspaces/[id]/library/page.tsx` — заглушка заменена полноценной страницей референсов
- Утилиты (`extractYouTubeVideoId`, `formatDuration`, `formatTimecode`) импортируются из `lib/utils/youtube.ts` (chunk 1), дублирования нет
- Убрана зависимость от `useWorkspacesQuery()` + auto-select useEffect — workspace layout уже обеспечивает загрузку и валидацию

### Chunk 3 ✅ DONE

**Полные настройки внутри воркспейса**

- Перезаписан `src/app/(dashboard)/workspaces/[id]/settings/page.tsx` — заглушка ("Раздел в разработке") заменена полной страницей настроек
- `workspaceId` берётся из URL (`Number(useParams().id)`), убрана зависимость от `useWorkspacesQuery()` + auto-select `useEffect`
- Используются вынесенные компоненты из chunk 1: `TeamTab`, `InvitationsTab` из `components/features/settings/`
- Breadcrumbs: company → workspace → Настройки
- Табы: Команда (форма приглашения + список участников) / Приглашения (pending инвайты с отменой)
- `keepMounted={false}` на табах — ленивый рендеринг неактивных панелей

### Chunk 4 ✅ DONE

**Редиректы, сайдбар, Workspace Hub**

- Перезаписан `src/app/(dashboard)/library/page.tsx` → redirect-страница: `activeWorkspace` → `/workspaces/${id}/references` с пробросом `searchParams`, fallback: fetch workspaces → первый → redirect, нет воркспейсов → `EmptyState`
- Перезаписан `src/app/(dashboard)/library/[id]/page.tsx` → redirect-страница: `activeWorkspace` → `/workspaces/${wsId}/references/${contentId}`, аналогичный fallback
- Перезаписан `src/app/(dashboard)/settings/page.tsx` → redirect-страница: `activeWorkspace` → `/workspaces/${wsId}/settings`, аналогичный fallback
- Изменён `src/app/(dashboard)/layout.tsx`:
  - Убраны "Библиотека" и "Настройки" из `generalLinks` (остались "Главная" + "Компании" для platform owner)
  - В `workspaceLinks`: `/workspaces/${id}/library` → `/workspaces/${id}/references`, label "Референсы", icon `IconSearch`
  - Заменён импорт `IconLibrary` → `IconSearch`
- Изменён `src/app/(dashboard)/workspaces/[id]/page.tsx` — SectionCard: "Библиотека" → "Референсы", href → `/workspaces/${id}/references`, icon `IconSearch` вместо `IconLibrary`
- Изменён `src/app/(dashboard)/companies/page.tsx` — guard redirect для не-platform-owner: `/library` → `/dashboard`
- Удалён `src/app/(dashboard)/library/library.module.css` — redirect-страница не использует стили
- Удалён `src/app/(dashboard)/library/[id]/content-detail.module.css` — redirect-страница не использует стили

### Chunk 5 ✅ DONE

**Cleanup — удаление мёртвого кода**

- Проверена папка `workspaces/[id]/library/` — уже удалена в chunk 2
- Проверены CSS файлы `library/library.module.css` и `library/[id]/content-detail.module.css` — уже удалены в chunk 4
- Проверен `IconLibrary` — нигде не импортируется, уже заменён на `IconSearch` в chunk 4
- Удалены неиспользуемые CSS-классы из `src/app/(dashboard)/dashboard.module.css`:
  - `.sectionTitle` — больше не используется (references и companies имеют свои собственные определения в `references.module.css` и `companies.module.css`)
  - `.logoIcon` — нигде не импортируется
  - `.headerTitle` — нигде не импортируется
- `features/library/TranscriptionDrawer.tsx` + `.module.css` — не тронуты (будет использован в следующих спринтах)
- `npx tsc --noEmit` — пройден без ошибок

---

## Sprint 6 — Workspace Navigation (завершён)

**Цель**: Навигационный скелет — dashboard с карточками воркспейсов, hub-страница, conditional sidebar. Только фронтенд, бэкенд не меняется.

### Chunk 1 ✅ DONE

**Коммит**: `feat(dashboard): add workspace cards grid and create modal`

- Переписан `app/(dashboard)/dashboard/page.tsx` — убран `redirect('/library')`, теперь отображает grid карточек воркспейсов через `useWorkspacesQuery()`
- Создан `WorkspaceCard` — карточка воркспейса: name, company_name, role badge (цвет по роли), badge "Личный" для personal workspace, дата создания, клик → `/workspaces/${id}`
- Создан `CreateWorkspaceModal` — модалка создания воркспейса (TextInput name + валидация Zod 1-255 символов)
- Добавлен `useCreateWorkspaceMutation` в `useWorkspaces.ts` — POST /api/v1/workspaces с invalidate queries
- Создана Zod-схема `createWorkspaceSchema` в `lib/validations/workspace.ts`
- Responsive grid: 1 колонка mobile, 2 sm, 3 lg (Mantine SimpleGrid)
- Состояния: Loading, Error (с retry), EmptyState
- Старые роуты `/library`, `/settings` не затронуты

### Chunk 2 ✅ DONE

**Workspace layout + hub-страница + заглушки разделов + breadcrumbs**

- Создан `app/(dashboard)/workspaces/[id]/layout.tsx` — data loader: загружает workspace через `useWorkspaceDetailQuery`, валидирует id (NaN → redirect), обрабатывает 403/404 → redirect `/dashboard` + notification, обновляет workspace-store
- Создан `app/(dashboard)/workspaces/[id]/page.tsx` — hub-страница: breadcrumbs (company / workspace) + заголовок + grid карточек разделов (Библиотека, Настройки)
- Создан `app/(dashboard)/workspaces/[id]/library/page.tsx` — заглушка с breadcrumbs (company / workspace / Библиотека)
- Создан `app/(dashboard)/workspaces/[id]/settings/page.tsx` — заглушка с breadcrumbs (company / workspace / Настройки)
- Создан `components/features/workspace/SectionCard.tsx` — карточка раздела (иконка, название, описание, стрелка-шеврон)
- Создан `components/shared/Breadcrumbs.tsx` — обёртка над Mantine Breadcrumbs: последний элемент без ссылки, truncate (max-width 200px)
- Добавлен `useWorkspaceDetailQuery(workspaceId)` в `api/hooks/useWorkspaces.ts` — GET /api/v1/workspaces/{id}
- Расширен `ActiveWorkspace` в `stores/workspace-store.ts` — добавлено поле `company_name`
- Исправлены вызовы `setActiveWorkspace` в `library/page.tsx` и `settings/page.tsx` (добавлен `company_name`)

### Chunk 3 ✅ DONE

**Коммит**: `feat(workspaces): add conditional sidebar for workspace navigation`

- Изменён `app/(dashboard)/layout.tsx` — sidebar теперь conditional по pathname:
  - **Вне воркспейса** (`/dashboard`, `/companies`, `/library`, `/settings`): общая навигация (Главная, Библиотека, Настройки, Компании)
  - **Внутри воркспейса** (`/workspaces/[id]/*`): кнопка "← Все воркспейсы" → `/dashboard`, разделитель, имя воркспейса из store, ссылки Обзор / Библиотека / Настройки
- Определение контекста: `pathname.match(/^\/workspaces\/(\d+)/)` — извлекает workspaceId из URL
- Active state: exact match для "Обзор" (`pathname === href`), `startsWith` для разделов (Библиотека, Настройки)
- Имя воркспейса читается из `useWorkspaceStore` (обновляется workspace layout из Chunk 2)
- Добавлены импорты: `Divider`, `IconLayoutDashboard`, `IconArrowLeft`, `useWorkspaceStore`

---

## Sprint 5 — Companies (в процессе)

**Цель**: Иерархия компаний над воркспейсами. Platform owner управляет компаниями, каждый воркспейс принадлежит компании.

### Chunk 1 ✅ DONE

**Коммит**: `feat(companies): add Company model, migration, and workspace integration`

- Создана таблица `companies` (id, name, slug, is_default, soft delete) с partial unique index на slug
- Добавлен `company_id` FK (NOT NULL, ON DELETE RESTRICT) в таблицу `workspaces` + relationship
- 3-шаговая data migration: создание таблицы → seed DENCO (is_default=True) → backfill всех workspaces → NOT NULL → FK
- Создан `app/utils/slugify.py` — утилита slugify с транслитерацией кириллицы (перенесена из workspace_service + расширена)
- Создан `CompanyRepository` (минимальный: `get_by_slug`, `get_default`)
- Обновлён `WorkspaceResponse` — добавлены поля `company_id`, `company_name`
- Обновлён `PlatformWorkspaceResponse` — добавлены поля `company_id`, `company_name`
- Обновлён `WorkspaceCreate` — добавлено опциональное поле `company_id`
- `selectinload(Workspace.company)` во всех repository-запросах (fix N+1)
- При регистрации personal workspace создаётся в default company
- При создании workspace: если `company_id` не передан → берётся из personal ws → или из default company
- Добавлен `default_company_slug` в `config.py`
- Обновлены тесты: seed DENCO в conftest, fix хелпера в test_transcription_service
- Применена миграция `8f4620605110`

### Chunk 2 ✅ DONE

**Коммит**: `feat(companies): add Company schemas and repository`

- Создан `app/schemas/company.py` — `CompanyCreate`, `CompanyUpdate`, `CompanyResponse`, `CompanyDetailResponse`
- Расширен `CompanyRepository` полным CRUD + статистика:
  - `get_all(params, search)` — пагинированный список с поиском по имени
  - `has_active_workspaces(company_id)` — проверка наличия активных воркспейсов (для защиты от удаления)
  - `slug_exists(slug, exclude_id)` — проверка уникальности slug
  - `get_detail_stats(company_id)` — агрегация `workspaces_count`, `members_count` (уникальные через workspace_members), `content_count`
- `is_default` добавлен в `CompanyResponse` для фронтенда (пометка DENCO, запрет удаления)

### Chunk 3 ✅ DONE

**Коммит**: `feat(companies): add Company CRUD API for platform owners`

- Создан `app/services/company_service.py` — бизнес-логика компаний:
  - `create_company` — генерация slug, проверка уникальности с суффиксом, лимит 100 компаний
  - `get_company` — детали + статистика (workspaces_count, members_count, content_count)
  - `list_companies` — пагинация + поиск по имени
  - `update_company` — обновление name с перегенерацией slug
  - `delete_company` — защита default company (is_default) и компаний с активными воркспейсами
- Создан `app/api/companies.py` — 5 CRUD endpoints под `/api/v1/platform/companies`:
  - `GET /` — список компаний (пагинация, search)
  - `POST /` — создать (201)
  - `GET /{company_id}` — детали + stats
  - `PATCH /{company_id}` — обновить
  - `DELETE /{company_id}` — soft-delete (204)
- Все endpoints требуют `require_platform_owner`
- Добавлен query param `company_id` в `GET /api/v1/platform/workspaces` для фильтрации воркспейсов по компании
- Обновлён `WorkspaceRepository.get_all_workspaces()` — поддержка фильтрации по `company_id`
- Обновлён `PlatformService.list_workspaces()` — прокидывает `company_id`

---

## Sprint 4 — Workspaces & Teams (завершён, 2026-03-12)

**Цель**: Расширение ролевой системы — platform owner, приглашения по ссылке, передача ownership.

### Chunk 1 ✅ DONE

**Коммит**: ожидает (`feat(models): add WorkspaceInvitation model and is_platform_owner field`)

- Добавлено поле `is_platform_owner: bool` в таблицу `users`
- Создана таблица `workspace_invitations` с partial unique index и row-level lock поддержкой
- Создан `InvitationStatus` enum: `pending / accepted / expired / cancelled`
- Добавлен `frontend_url` в `config.py` для генерации инвайт-ссылок
- Применена миграция `1df12fc898d5`

### Chunk 2 ✅ DONE

**Коммит**: `feat(auth): add platform owner read-only access to all workspaces`

- `require_platform_owner` dependency в `app/dependencies.py`
- Synthetic VIEWER bypass в 3 точках авторизации: `get_workspace_from_path`, `_require_membership`, `_require_manage_permission`
- `is_platform_owner` добавлен в `UserResponse`
- Fix #9: ADMIN не может изменять другого ADMIN (только OWNER)

### Chunk 3 ✅ DONE

**Коммит**: `feat(platform): add admin API for workspaces and users`

- `GET /api/v1/platform/workspaces` — все воркспейсы с пагинацией и поиском
- `GET /api/v1/platform/workspaces/{id}` — детали + счётчик members
- `POST /api/v1/platform/workspaces/{id}/join` — добавить себя как member
- `GET /api/v1/platform/users` — все юзеры платформы
- Отдельная `PlatformWorkspaceResponse` без поля `role` (fix #8)

### Chunk 4 ✅ DONE

**Коммит**: `feat(workspaces): add ownership transfer endpoint`

- `POST /api/v1/workspaces/{id}/transfer-ownership` — передача ownership
- Только OWNER может вызвать, нельзя для личного workspace
- Атомарно: старый OWNER → ADMIN, target → OWNER (одна транзакция)
- Новая схема `TransferOwnershipRequest` в `app/schemas/workspace.py`

### Chunk 5 ✅ DONE

**Коммит**: `feat(invitations): add invitation service and repository`

- `InvitationRepository` с методами: `get_by_token_for_update` (SELECT FOR UPDATE), `get_pending_by_email`, `cancel_all_for_workspace`
- `InvitationService`: create, accept, cancel, get_invitation_info
- Лимит 20 pending инвайтов на workspace (fix #6)
- Проверка `expires_at` (7 дней, fix #10)
- Email-матч при accept (fix #4)
- Partial unique index `UNIQUE(workspace_id, email) WHERE status='pending'` (fix #6)

### Chunk 6 ✅ DONE

**Коммит**: `feat(invitations): add invitation API endpoints`

- `POST /api/v1/workspaces/{id}/invitations` — создать инвайт (OWNER/ADMIN)
- `GET /api/v1/workspaces/{id}/invitations` — список инвайтов
- `DELETE /api/v1/workspaces/{id}/invitations/{invitation_id}` — отменить
- `GET /api/v1/invitations/{token}` — публичная инфо (masked email)
- `POST /api/v1/invitations/{token}/accept` — принять (требует auth)

### Chunk 7 ✅ DONE

**Коммит**: `feat(auth): auto-accept invitations on registration`

- Auto-accept pending invitations при регистрации нового юзера (fix #12)
- Отмена инвайтов при soft-delete workspace (fix #7)
- Защита от дубликатов: если уже member → invite cancelled

---

## Sprint 3 — Transcription Pipeline (завершён)

**Диапазон коммитов**: `162213a` → `724dffd`

### Добавлено

- **Whisper (локально)**: транскрипция аудио в текст, модели `tiny` → `large`, хранение сегментов с таймкодами в JSONB
- **Speaker diarization**: интеграция `pyannote.audio` для разделения по спикерам (Speaker 0, Speaker 1...)
- **Нормализация через Claude API**: сегменты с полным контекстом нормализуются в читаемый текст через Anthropic API
- **Статусы обработки**: `processing_step` в `content_items` для отслеживания прогресса пайплайна
- **Recovery task**: Celery-задача для восстановления зависших элементов пайплайна
- **Retry логика**: автоматические повторы при ошибках загрузки и транскрипции

### Исправлено

- `selectinload` для relation `transcription` → предотвращение `MissingGreenlet` ошибки
- Заменён устаревший `use_auth_token` на `token` в pyannote 4.x
- Извлечение `Annotation` из `DiarizeOutput` для совместимости с pyannote 4.x

### Схема пайплайна

```
POST /api/v1/content  →  ContentItem(status=PENDING)
        │
        ▼ Celery
parse_metadata (yt-dlp)
        │  title, description, duration
        ▼
download_audio (yt-dlp WAV extraction)
        │  audio saved to AUDIO_STORAGE_PATH
        ▼
transcribe_content (Whisper local)
        │  segments[] с таймкодами → JSONB
        ▼
diarize (pyannote.audio)
        │  speaker labels per segment
        ▼
normalize (Claude API)
        │  читаемый текст с разделением по спикерам
        ▼
ContentItem(status=COMPLETED) + Transcription(status=COMPLETED)
```

---

## Sprint 2 — Content Pipeline & Deploy (завершён)

**Диапазон коммитов**: `d8f1f51` → `66c033d`

### Добавлено

- **Celery + Redis**: асинхронная обработка задач, очередь `transcription` для тяжёлых задач
- **ContentItem модель**: статусы `PENDING / PROCESSING / DOWNLOADING / COMPLETED / FAILED`, мягкое удаление
- **YouTube интеграция**: парсинг метаданных (yt-dlp), загрузка аудио в WAV
- **Content API**: CRUD endpoints с workspace-based доступом, валидация YouTube URL
- **Деплой на продакшен**:
  - Сервер `155.212.190.58`, домен `marketing.denco.store` (SSL Let's Encrypt)
  - systemd сервисы `denco-backend.service` + `denco-celery.service`
  - nginx reverse proxy → uvicorn :8001
- **Рефакторинг**: переименование `source_url` → `url`, `parse_content` → `parse_metadata`

### Исправлено

- Закреплена версия `bcrypt<4.1` для совместимости с `passlib`

---

## Sprint 1 — Core Foundation (завершён)

**Диапазон коммитов**: `ca6d068` → `afe1b54`

### Добавлено

- **Scaffold**: Docker Compose (PostgreSQL + pgAdmin), `pyproject.toml`, зависимости
- **App core**: FastAPI app, lifespan, `structlog` логирование, `RequestIDMiddleware`, `LoggingMiddleware`, CORS, health endpoint
- **Config**: Pydantic BaseSettings, `.env` через `config.py`, `postgresql+asyncpg` URL
- **Base models**: `TimestampMixin`, `SoftDeleteMixin`, `BaseRepository[T]` с generic CRUD и flush-паттерном
- **Auth**: User model, `passlib[bcrypt]` хэши, JWT access+refresh (`python-jose`), endpoints: register / login / refresh / logout, личный workspace при регистрации
- **Workspaces**:
  - Модели `Workspace`, `WorkspaceMember`, enum `WorkspaceRole` (OWNER/ADMIN/EDITOR/VIEWER/CONTRACTOR)
  - Dependency `get_workspace_from_path` + `require_role`
  - CRUD workspace + members с ролевым доступом
  - Авто-создание личного workspace при регистрации
- **Alembic**: начальная миграция со всеми таблицами
- **Тесты**: интеграционные тесты всех workspace endpoints (pytest-asyncio + httpx AsyncClient)

---

## Зависимости

| Компонент | Версия |
|-----------|--------|
| Python | 3.13 |
| FastAPI | latest |
| SQLAlchemy | 2.x (async) |
| Alembic | latest |
| Pydantic | v2 |
| Celery | latest |
| Whisper | openai-whisper |
| pyannote.audio | 4.x |
| anthropic | latest |
| Next.js | 15 |
| Mantine | latest |
| TanStack Query | v5 |
