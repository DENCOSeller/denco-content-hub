# Architecture

## Содержание

1. [Схема базы данных](#схема-базы-данных)
2. [Пайплайн обработки видео](#пайплайн-обработки-видео)
3. [Ролевая модель](#ролевая-модель)
4. [API структура](#api-структура)
5. [Инфраструктура](#инфраструктура)

---

## Схема базы данных

### ERD (текстовый вид)

```
users
 ├── id (PK)
 ├── email (UNIQUE, soft-delete aware)
 ├── name
 ├── hashed_password
 ├── is_active
 ├── is_platform_owner          ← Sprint 4
 ├── created_at / updated_at
 └── deleted_at                 ← SoftDelete

companies                        ← Sprint 5
 ├── id (PK)
 ├── name
 ├── slug (UNIQUE, soft-delete aware)
 ├── is_default                  ← защита от удаления (DENCO)
 ├── created_at / updated_at
 └── deleted_at                 ← SoftDelete

workspaces
 ├── id (PK)
 ├── name
 ├── slug (UNIQUE, soft-delete aware)
 ├── is_personal
 ├── company_id (FK → companies.id, NOT NULL, ON DELETE RESTRICT)  ← Sprint 5
 ├── created_at / updated_at
 └── deleted_at                 ← SoftDelete

workspace_members
 ├── id (PK)
 ├── user_id (FK → users.id)
 ├── workspace_id (FK → workspaces.id)
 ├── role (enum: owner/admin/editor/viewer/contractor)
 ├── UNIQUE(user_id, workspace_id)
 └── created_at / updated_at

workspace_invitations            ← Sprint 4
 ├── id (PK)
 ├── workspace_id (FK → workspaces.id)
 ├── email
 ├── role (enum: WorkspaceRole)
 ├── invited_by_user_id (FK → users.id)
 ├── token (UNIQUE)              ← secrets.token_urlsafe(32)
 ├── status (pending/accepted/expired/cancelled)
 ├── expires_at
 ├── UNIQUE(workspace_id, email) WHERE status='pending'  ← Partial
 ├── INDEX(email, status)        ← auto-accept при регистрации
 └── created_at / updated_at

content_items
 ├── id (PK)
 ├── workspace_id (FK → workspaces.id)
 ├── added_by_user_id (FK → users.id)
 ├── source_url
 ├── source_type (youtube_video)
 ├── video_id
 ├── title / description / duration
 ├── status (pending/processing/downloading/completed/failed)
 ├── processing_step             ← текущий шаг пайплайна
 ├── error_message / retry_count / celery_task_id
 ├── raw_file_path / audio_path
 ├── created_at / updated_at
 └── deleted_at                 ← SoftDelete

transcriptions
 ├── id (PK)
 ├── content_item_id (FK → content_items.id, UNIQUE)
 ├── status (pending/processing/completed/failed)
 ├── text                       ← нормализованный текст
 ├── language
 ├── duration_seconds
 ├── whisper_model
 ├── segments (JSONB)           ← [{start, end, text, speaker}]
 ├── error_message / retry_count / celery_task_id
 └── created_at / updated_at
```

### Миграции (в хронологическом порядке)

| Файл | Изменения |
|------|-----------|
| `0e8b8dcf8f30_init` | Начальная схема: users, workspaces, workspace_members |
| `287530c10c6a_add_content_items` | Таблица content_items |
| `5a92436f2681_add_transcriptions` | Таблица transcriptions |
| `8bbd4d787381_add_segments_jsonb` | JSONB поле segments в transcriptions |
| `c7de8c3861e3_add_processing_step` | Поле processing_step в content_items |
| `1df12fc898d5_add_workspace_invitations` | Таблица workspace_invitations + is_platform_owner в users |
| `8f4620605110_add_companies` | Таблица companies + company_id FK в workspaces + seed DENCO |

---

## Пайплайн обработки видео

### Схема

```
Пользователь
     │
     │  POST /api/v1/content  { url: "https://youtube.com/watch?v=..." }
     ▼
ContentItem создан (status=PENDING)
     │
     │  Celery task dispatched
     ▼
┌─────────────────────────────────────────────────────────┐
│                    CELERY WORKER                         │
│                                                         │
│  1. parse_metadata                                      │
│     └── yt-dlp: title, description, duration           │
│     └── status → PROCESSING, processing_step=metadata  │
│                                                         │
│  2. download_audio                                      │
│     └── yt-dlp: скачать и конвертировать в WAV         │
│     └── сохранить в AUDIO_STORAGE_PATH                  │
│     └── processing_step=downloading                     │
│                                                         │
│  3. transcribe_content                                  │
│     └── Whisper (локально): audio → segments[]         │
│     └── Transcription создана (segments в JSONB)       │
│     └── processing_step=transcribing                    │
│                                                         │
│  4. diarize (в рамках transcribe_content)               │
│     └── pyannote.audio: определить спикеров            │
│     └── аннотировать каждый сегмент: speaker=SPEAKER_0 │
│                                                         │
│  5. normalize (в рамках transcribe_content)             │
│     └── Claude API (claude-sonnet): нормализовать текст│
│     └── читаемый текст с разделением по спикерам       │
│     └── Transcription.text = нормализованный результат  │
│                                                         │
│  ContentItem.status → COMPLETED                         │
│  Transcription.status → COMPLETED                       │
└─────────────────────────────────────────────────────────┘
```

### Обработка ошибок

- Каждый Celery-таск: автоматический retry с exponential backoff
- `retry_count` хранится в `content_items` и `transcriptions`
- При превышении лимита: `status=FAILED`, `error_message` с деталями
- Recovery task: находит зависшие записи (status=PROCESSING > N минут) и перезапускает

### Celery очереди

| Очередь | Задачи |
|---------|--------|
| `default` | parse_metadata, download_audio |
| `transcription` | transcribe_content (GPU/CPU тяжёлые) |

---

## Ролевая модель

### Платформенный уровень

| Роль | Хранение | Доступ |
|------|----------|--------|
| Обычный пользователь | — | Только свои воркспейсы |
| Platform Owner | `users.is_platform_owner = True` | Read-only ко всем воркспейсам. Может добавить себя через `/platform/.../join` |

`is_platform_owner` устанавливается только через прямой SQL. API для этого нет.

### Уровень воркспейса

| Роль | Content CRUD | Управление участниками | Настройки WS | Удаление WS |
|------|-------------|----------------------|--------------|-------------|
| OWNER | ✅ всё | ✅ все роли | ✅ | ✅ |
| ADMIN | ✅ всё | ✅ кроме OWNER и других ADMIN | ✅ | ❌ |
| EDITOR | ✅ всё | ❌ | ❌ | ❌ |
| VIEWER | 👁 только чтение | ❌ | ❌ | ❌ |
| CONTRACTOR | ✅ добавить + смотреть | ❌ | ❌ | ❌ |

> CONTRACTOR скрыт в UI. Используется для внешних исполнителей.

### Инвайты (Sprint 4)

```
OWNER/ADMIN создаёт инвайт
     │  POST /workspaces/{id}/invitations  { email, role }
     │  возвращает: { invite_link: "{frontend_url}/invite/{token}" }
     │
     ▼
Получатель переходит по ссылке
     │  GET /invitations/{token}  →  workspace_name, role, masked_email
     │
     ▼
Авторизуется и принимает
     │  POST /invitations/{token}/accept
     │  Проверки: status=PENDING, expires_at > now, email совпадает
     │
     ▼
WorkspaceMember создан
```

---

## API структура

Все endpoints под префиксом `/api/v1` (настраивается в `config.py`).

### Endpoints

| Метод | Путь | Описание | Доступ |
|-------|------|----------|--------|
| GET | `/health` | Статус сервиса + DB + Redis | Public |
| POST | `/auth/register` | Регистрация + личный workspace | Public |
| POST | `/auth/login` | Логин → JWT tokens | Public |
| POST | `/auth/refresh` | Обновить access token | Auth |
| GET | `/users/me` | Профиль текущего юзера | Auth |
| PATCH | `/users/me` | Обновить профиль | Auth |
| GET | `/workspaces` | Воркспейсы текущего юзера | Auth |
| POST | `/workspaces` | Создать воркспейс | Auth |
| GET | `/workspaces/{id}` | Детали воркспейса | Member |
| PATCH | `/workspaces/{id}` | Обновить воркспейс | OWNER/ADMIN |
| DELETE | `/workspaces/{id}` | Удалить воркспейс (soft) | OWNER |
| POST | `/workspaces/{id}/transfer-ownership` | Передать ownership | OWNER *(Sprint 4)* |
| GET | `/workspaces/{id}/members` | Список участников | Member |
| POST | `/workspaces/{id}/members` | Добавить участника | OWNER/ADMIN |
| PATCH | `/workspaces/{id}/members/{mid}` | Изменить роль | OWNER/ADMIN |
| DELETE | `/workspaces/{id}/members/{mid}` | Удалить участника | OWNER/ADMIN |
| POST | `/workspaces/{id}/members/leave` | Покинуть воркспейс | Member |
| POST | `/workspaces/{id}/invitations` | Создать инвайт | OWNER/ADMIN *(Sprint 4)* |
| GET | `/workspaces/{id}/invitations` | Список инвайтов | OWNER/ADMIN *(Sprint 4)* |
| DELETE | `/workspaces/{id}/invitations/{iid}` | Отменить инвайт | OWNER/ADMIN *(Sprint 4)* |
| GET | `/invitations/{token}` | Инфо об инвайте | Public *(Sprint 4)* |
| POST | `/invitations/{token}/accept` | Принять инвайт | Auth *(Sprint 4)* |
| GET | `/platform/workspaces` | Все воркспейсы | Platform Owner *(Sprint 4)* |
| GET | `/platform/workspaces/{id}` | Детали + статистика | Platform Owner *(Sprint 4)* |
| POST | `/platform/workspaces/{id}/join` | Добавить себя | Platform Owner *(Sprint 4)* |
| GET | `/platform/users` | Все пользователи | Platform Owner *(Sprint 4)* |
| GET | `/content` | Контент воркспейса | Member |
| POST | `/content` | Добавить YouTube URL | EDITOR+ |
| GET | `/content/{id}` | Детали контента + статус | Member |
| DELETE | `/content/{id}` | Удалить контент (soft) | EDITOR+ |
| POST | `/content/{id}/retry` | Повторить обработку | EDITOR+ |
| GET | `/transcriptions/{id}` | Транскрипция | Member |

### Стандартные форматы ответов

**Пагинация** (все list endpoints):
```json
{
  "items": [...],
  "total": 42,
  "page": 1,
  "size": 20,
  "pages": 3
}
```

**Ошибка**:
```json
{ "detail": "Workspace not found" }
```

**Auth**: `Authorization: Bearer <access_token>` (HTTPBearer)

---

## Инфраструктура

### Продакшен сервер

```
155.212.190.58
├── nginx (port 80/443)
│   └── SSL: marketing.denco.store (Let's Encrypt)
│   └── proxy_pass → localhost:8001
│
├── uvicorn app.main:app --port 8001
│   └── systemd: denco-backend.service
│
├── celery -A app.worker.celery_app worker
│   └── systemd: denco-celery.service
│
├── PostgreSQL (docker или системный)
│
└── Redis (localhost:6379)
    ├── DB 0: Cache
    ├── DB 1: Celery broker
    └── DB 2: Celery results
```

### systemd управление

```bash
# Статус
systemctl status denco-backend.service
systemctl status denco-celery.service

# Рестарт после деплоя
systemctl restart denco-backend.service
systemctl restart denco-celery.service

# Логи
journalctl -u denco-backend.service -f
journalctl -u denco-celery.service -f
```

### CORS настройки

| Окружение | Origins |
|-----------|---------|
| Dev | `http://localhost:3000` |
| Prod | `https://marketing.denco.store`, `http://155.212.190.58` |

> `allow_origins=["*"]` с `allow_credentials=True` — **НИКОГДА**.

### Dev окружение

```bash
# PostgreSQL + pgAdmin
docker-compose up -d
# pgAdmin: http://localhost:5050

# Backend hot-reload
uvicorn app.main:app --reload --port 8000

# Проверка качества кода
ruff check . && ruff format .
pyrefly check .

# Тесты
pytest -v --cov=app
```
