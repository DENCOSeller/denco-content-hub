# Denco Content Hub

Платформа для команд: добавляй YouTube-видео, получай транскрипции с разделением по спикерам и нормализацией через Claude AI. Управляй доступом через воркспейсы с ролевой моделью.

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 15)          Backend (FastAPI + Python 3.13) │
│  :3000                          :8001 (prod: nginx reverse proxy)│
│                                                                  │
│  Mantine UI + TanStack Query ──► REST API /api/v1               │
│  Hey-api (auto-generated)        JWT Auth                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │  PostgreSQL                  │
        │  Redis (Celery broker/cache) │
        └─────────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │  Celery Worker               │
        │  yt-dlp → Whisper → pyannote │
        │  → Claude API (normalize)    │
        └─────────────────────────────┘
```

## Быстрый старт

### Требования

- Docker + Docker Compose
- Python 3.13
- Node.js 20+
- Redis

### 1. Backend

```bash
cd denco-content-hub-backend

# Скопируй конфиг
cp .env.example .env
# Заполни .env: database_url, secret_key, anthropic_api_key, huggingface_token

# Подними PostgreSQL + pgAdmin
docker-compose up -d

# Установи зависимости
pip install -r requirements.txt

# Примени миграции
alembic upgrade head

# Запусти сервер
uvicorn app.main:app --reload --port 8000
```

### 2. Celery Worker (в отдельном терминале)

```bash
cd denco-content-hub-backend
celery -A app.worker.celery_app worker --loglevel=info
```

### 3. Frontend

```bash
cd denco-content-hub-frontend

cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

npm install

# Сгенерировать API-клиент (нужен запущенный backend)
npx @hey-api/openapi-ts --input http://localhost:8000/openapi.json --output src/api/client

npm run dev
```

Открой [http://localhost:3000](http://localhost:3000)

### Переменные окружения (.env)

| Переменная | Описание | Обязательно |
|-----------|----------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host/db` | ✅ |
| `SECRET_KEY` | JWT secret (openssl rand -hex 32) | ✅ |
| `ANTHROPIC_API_KEY` | Claude API для нормализации | ✅ |
| `HUGGINGFACE_TOKEN` | pyannote дiaризация | ✅ |
| `REDIS_URL` | `redis://localhost:6379/0` | ✅ |
| `CELERY_BROKER_URL` | `redis://localhost:6379/1` | ✅ |
| `FRONTEND_URL` | URL фронта (для инвайт-ссылок) | ✅ |
| `WHISPER_MODEL_SIZE` | `tiny/base/small/medium/large` | — |
| `CORS_ORIGINS` | Список разрешённых origins | — |

## Структура репозитория

```
denco-content-hub/
├── denco-content-hub-backend/   # Python FastAPI + Celery
│   ├── app/                     # Приложение
│   ├── migrations/              # Alembic миграции
│   ├── tests/                   # pytest тесты
│   ├── CLAUDE.md                # AI-инструкции для бэкенда
│   └── docker-compose.yml       # PostgreSQL + pgAdmin для dev
│
├── denco-content-hub-frontend/  # Next.js 15 + TypeScript
│   ├── src/                     # Исходники
│   ├── CLAUDE.md                # AI-инструкции для фронтенда
│   └── package.json
│
└── docs/
    ├── ARCHITECTURE.md          # Схема БД, пайплайн, инфраструктура
    └── CHANGELOG.md             # История спринтов
```

## Документация

- [Архитектура и схема БД](docs/ARCHITECTURE.md)
- [История изменений](docs/CHANGELOG.md)
- [Инструкции для AI (бэкенд)](denco-content-hub-backend/CLAUDE.md)
- [Инструкции для AI (фронтенд)](denco-content-hub-frontend/CLAUDE.md)

## Продакшен

- **Сервер**: `155.212.190.58`
- **Домен**: [https://marketing.denco.store](https://marketing.denco.store)
- **Backend**: uvicorn :8001 за nginx, systemd `denco-backend.service`
- **Celery**: systemd `denco-celery.service`

Подробнее: [docs/ARCHITECTURE.md#инфраструктура](docs/ARCHITECTURE.md#инфраструктура)
