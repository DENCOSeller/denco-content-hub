# Changelog

История спринтов, реконструированная из git log и стратегических файлов.

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
