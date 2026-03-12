# Changelog

История спринтов, реконструированная из git log и стратегических файлов.

---

## Sprint 4 — Workspaces & Teams (в работе, 2026-03-12)

**Цель**: Расширение ролевой системы — platform owner, приглашения по ссылке, передача ownership.

### Chunk 1 ✅ DONE

**Коммит**: ожидает (`feat(models): add WorkspaceInvitation model and is_platform_owner field`)

- Добавлено поле `is_platform_owner: bool` в таблицу `users`
- Создана таблица `workspace_invitations` с partial unique index и row-level lock поддержкой
- Создан `InvitationStatus` enum: `pending / accepted / expired / cancelled`
- Добавлен `frontend_url` в `config.py` для генерации инвайт-ссылок
- Применена миграция `1df12fc898d5`

### Chunks 2–7 🔄 В ПЛАНИРОВАНИИ

Детальный план: `denco-content-hub-backend/chunks-workspaces.md`

| Chunk | Что | Закрывает |
|-------|-----|-----------|
| 2 | Platform owner read-only bypass (synthetic VIEWER) | fix #1 — 3 точки авторизации |
| 3 | Platform API: `/platform/workspaces`, `/platform/users`, `/platform/.../join` | fix #2, #8 |
| 4 | Transfer ownership: `POST /workspaces/{id}/transfer-ownership` | fix #3 |
| 5 | Invitation service + repository (с `SELECT FOR UPDATE`) | fix #4, #5, #6, #7, #10 |
| 6 | Invitation API endpoints (create, list, cancel, public accept) | — |
| 7 | Auto-accept при регистрации + cleanup при удалении workspace | fix #7, #12 |

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
