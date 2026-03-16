# Chunks — Sprint 2: YouTube Parsing

Спринт 2 добавляет ядро продукта — возможность добавлять контент по URL (начинаем с YouTube), парсить метаданные через yt-dlp, обрабатывать в фоне через Celery.

Каждый chunk — атомарная единица работы. Выполняются строго последовательно.
После каждого chunk: `ruff check . && ruff format .` + `pyrefly check .` + коммит.

---

## Обзор архитектуры Sprint 2

### Новые компоненты

```
┌─────────┐    POST /content     ┌──────────┐    Celery task     ┌──────────┐
│ Frontend │ ─────────────────→  │  FastAPI  │ ───────────────→   │  Worker  │
│          │                     │           │                    │ (Celery) │
│          │    GET /content     │  Content  │    result_backend  │          │
│          │ ←───────────────    │  Service  │ ←───────────────   │  yt-dlp  │
└─────────┘                     └──────────┘                    └──────────┘
                                      │                               │
                                      ▼                               ▼
                                ┌──────────┐                   ┌──────────┐
                                │ PostgreSQL│                   │  Redis   │
                                │ content_  │                   │  broker  │
                                │ items     │                   │ + result │
                                └──────────┘                   └──────────┘
```

### Жизненный цикл ContentItem

```
POST /content {url} → PENDING → Celery task → PROCESSING → yt-dlp → COMPLETED / FAILED
                         │                                      │
                         │         (максимум 3 retry)          │
                         └──────────────────────────────────────┘
```

### Статусы обработки

```python
class ContentStatus(str, Enum):
    PENDING    = "pending"      # Создан, задача в очереди
    PROCESSING = "processing"   # Worker взял в обработку
    COMPLETED  = "completed"    # Метаданные получены
    FAILED     = "failed"       # Ошибка (макс. retries исчерпаны)
```

### Типы контента

```python
class ContentType(str, Enum):
    YOUTUBE_VIDEO = "youtube_video"
    # Будущие: instagram_post, tiktok_video, article, etc.
```

---

## Chunk 1: Celery + Redis broker infrastructure

**Цель:** Celery worker запускается, принимает и выполняет тестовую задачу.

**Файлы:**
```
app/worker/__init__.py
app/worker/celery_app.py
app/worker/tasks/__init__.py
app/config.py                    (обновить: добавить celery settings)
docker-compose.yml               (обновить: добавить celery worker)
pyproject.toml                   (обновить: добавить celery + yt-dlp)
```

**Что делает:**

1. `pyproject.toml` — добавить зависимости:
   ```
   celery[redis] >= 5.4.0
   yt-dlp >= 2024.12.0
   ```

2. `config.py` — добавить в Settings:
   ```python
   celery_broker_url: str = "redis://localhost:6379/1"
   celery_result_backend: str = "redis://localhost:6379/2"
   ```
   Redis index 0 — auth blacklist (Sprint 1), index 1 — Celery broker, index 2 — Celery results.

3. `worker/celery_app.py`:
   ```python
   from celery import Celery
   from app.config import get_settings

   settings = get_settings()

   celery_app = Celery(
       "denco_worker",
       broker=settings.celery_broker_url,
       backend=settings.celery_result_backend,
   )

   celery_app.conf.update(
       task_serializer="json",
       result_serializer="json",
       accept_content=["json"],
       timezone="UTC",
       enable_utc=True,
       task_track_started=True,
       task_acks_late=True,            # retry при crash worker'а
       worker_prefetch_multiplier=1,   # один task за раз
       result_expires=3600,            # результаты живут 1 час
   )

   celery_app.autodiscover_tasks(["app.worker.tasks"])
   ```

4. `docker-compose.yml` — добавить сервис:
   ```yaml
   celery-worker:
     build: .
     command: celery -A app.worker.celery_app worker --loglevel=info --concurrency=2
     volumes:
       - .:/code
     env_file:
       - .env
     depends_on:
       - redis
       - postgres
     restart: unless-stopped
   ```

5. `.env.example` — добавить:
   ```
   CELERY_BROKER_URL=redis://redis:6379/1
   CELERY_RESULT_BACKEND=redis://redis:6379/2
   ```

**Проверка:**
```bash
# В одном терминале
celery -A app.worker.celery_app worker --loglevel=info

# В другом — проверка
python -c "from app.worker.celery_app import celery_app; print(celery_app.control.ping())"
```

**Коммит:** `infra: add Celery worker with Redis broker`

---

## Chunk 2: ContentItem model + migration

**Цель:** Таблица `content_items` в БД, модель привязана к workspace.

**Файлы:**
```
app/models/content_item.py
app/models/__init__.py             (обновить: реэкспорт ContentItem)
migrations/versions/003_add_content_items.py  (autogenerate)
```

**Что делает:**

1. `models/content_item.py`:
   ```python
   class ContentStatus(str, enum.Enum):
       PENDING = "pending"
       PROCESSING = "processing"
       COMPLETED = "completed"
       FAILED = "failed"

   class ContentType(str, enum.Enum):
       YOUTUBE_VIDEO = "youtube_video"

   class ContentItem(Base, TimestampMixin, SoftDeleteMixin):
       __tablename__ = "content_items"

       id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
       workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True)
       added_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

       # Источник
       original_url: Mapped[str] = mapped_column(String(2048))
       content_type: Mapped[ContentType] = mapped_column(
           SAEnum(ContentType, name="content_type_enum", create_constraint=True)
       )

       # Статус обработки
       status: Mapped[ContentStatus] = mapped_column(
           SAEnum(ContentStatus, name="content_status_enum", create_constraint=True),
           default=ContentStatus.PENDING,
           index=True,
       )
       error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
       retry_count: Mapped[int] = mapped_column(default=0)
       celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

       # Метаданные YouTube (заполняются после парсинга)
       title: Mapped[str | None] = mapped_column(String(500), nullable=True)
       description: Mapped[str | None] = mapped_column(Text, nullable=True)
       thumbnail_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
       duration_seconds: Mapped[int | None] = mapped_column(nullable=True)
       channel_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
       channel_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
       view_count: Mapped[int | None] = mapped_column(nullable=True)
       like_count: Mapped[int | None] = mapped_column(nullable=True)
       upload_date: Mapped[date | None] = mapped_column(nullable=True)
       video_id: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
       tags: Mapped[list | None] = mapped_column(JSON, nullable=True)

       # Relationships
       workspace: Mapped["Workspace"] = relationship(lazy="selectin")
       added_by: Mapped["User"] = relationship(lazy="selectin")

       __table_args__ = (
           Index("ix_content_items_workspace_status", "workspace_id", "status"),
           Index(
               "ix_content_items_workspace_video",
               "workspace_id", "video_id",
               unique=True,
               postgresql_where=text("deleted_at IS NULL AND video_id IS NOT NULL"),
           ),
       )
   ```

   **Ключевые решения:**
   - `workspace_id` — мультитенантность, фильтрация по воркспейсу
   - `video_id` — YouTube video ID (`dQw4w9WgXcQ`), partial unique index в рамках workspace (нельзя добавить один и тот же ролик дважды)
   - `celery_task_id` — для отслеживания задачи и отмены
   - `tags` — JSON-массив (PostgreSQL JSONB)
   - Метаданные nullable — заполняются ПОСЛЕ парсинга
   - Composite index `(workspace_id, status)` — для фильтрации по статусу в рамках ws

2. Миграция: `alembic revision --autogenerate -m "add content_items table"`
   - **Проверить:** partial unique index, enum types

**Проверка:** `alembic upgrade head` → таблица `content_items` создана. `\d content_items` показывает все колонки и indexes.

**Коммит:** `feat(content): add ContentItem model with status tracking`

---

## Chunk 3: Content schemas

**Цель:** Pydantic-схемы для всех content-операций.

**Файлы:**
```
app/schemas/content.py
app/schemas/__init__.py            (обновить)
```

**Что делает:**

```python
# app/schemas/content.py

from pydantic import BaseModel, HttpUrl, field_validator
from datetime import date, datetime
from urllib.parse import urlparse

# Белый список доменов — единый источник правды
YOUTUBE_ALLOWED_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}


class AddContentRequest(BaseModel):
    """Запрос на добавление контента по URL."""
    url: HttpUrl

    @field_validator("url")
    @classmethod
    def validate_supported_url(cls, v: HttpUrl) -> HttpUrl:
        url_str = str(v)
        parsed = urlparse(url_str)

        # Проверка через urlparse — защита от SSRF (R3)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("Поддерживаются только HTTP/HTTPS ссылки")

        if parsed.hostname not in YOUTUBE_ALLOWED_HOSTS:
            raise ValueError(
                "Поддерживаются только YouTube ссылки "
                "(youtube.com, youtu.be, m.youtube.com)"
            )

        return v


class ContentItemResponse(BaseModel):
    """Ответ с данными контента."""
    id: int
    workspace_id: int
    original_url: str
    content_type: str
    status: str
    error_message: str | None = None

    # Метаданные (nullable до завершения парсинга)
    title: str | None = None
    description: str | None = None
    thumbnail_url: str | None = None
    duration_seconds: int | None = None
    channel_name: str | None = None
    channel_url: str | None = None
    view_count: int | None = None
    like_count: int | None = None
    upload_date: date | None = None
    video_id: str | None = None
    tags: list[str] | None = None

    added_by_user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContentItemShortResponse(BaseModel):
    """Краткий ответ для списков."""
    id: int
    original_url: str
    content_type: str
    status: str
    title: str | None = None
    thumbnail_url: str | None = None
    channel_name: str | None = None
    duration_seconds: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ContentFilterParams(BaseModel):
    """Параметры фильтрации контента."""
    status: str | None = None        # pending, processing, completed, failed
    content_type: str | None = None  # youtube_video
    search: str | None = None        # поиск по title, channel_name
```

**Коммит:** `feat(content): add content schemas with YouTube URL validation`

---

## Chunk 4: Content repository

**Цель:** Data access layer для ContentItem.

**Файлы:**
```
app/repositories/content_repository.py
app/repositories/__init__.py       (обновить)
```

**Что делает:**

```python
# app/repositories/content_repository.py

class ContentRepository(BaseRepository[ContentItem]):
    def __init__(self, db: AsyncSession):
        super().__init__(ContentItem, db)

    async def get_by_workspace(
        self,
        workspace_id: int,
        pagination: PaginationParams,
        status: ContentStatus | None = None,
        content_type: ContentType | None = None,
        search: str | None = None,
    ) -> PaginatedResponse:
        """Список контента в воркспейсе с фильтрацией."""
        query = self._base_query().filter(ContentItem.workspace_id == workspace_id)

        if status:
            query = query.filter(ContentItem.status == status)
        if content_type:
            query = query.filter(ContentItem.content_type == content_type)
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    ContentItem.title.ilike(search_filter),
                    ContentItem.channel_name.ilike(search_filter),
                )
            )

        query = query.order_by(ContentItem.created_at.desc())
        return await paginate(query, self.db, pagination)

    async def get_by_video_id_in_workspace(
        self, workspace_id: int, video_id: str
    ) -> ContentItem | None:
        """Проверка дубликата YouTube видео в воркспейсе."""
        query = (
            self._base_query()
            .filter(ContentItem.workspace_id == workspace_id)
            .filter(ContentItem.video_id == video_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_workspace_and_id(
        self, workspace_id: int, content_id: int
    ) -> ContentItem | None:
        """Получить контент по ID в рамках воркспейса."""
        query = (
            self._base_query()
            .filter(ContentItem.workspace_id == workspace_id)
            .filter(ContentItem.id == content_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def update_status(
        self,
        content_item: ContentItem,
        status: ContentStatus,
        error_message: str | None = None,
        **metadata: Any,
    ) -> ContentItem:
        """Обновить статус и метаданные."""
        content_item.status = status
        if error_message is not None:
            content_item.error_message = error_message
        for key, value in metadata.items():
            if hasattr(content_item, key):
                setattr(content_item, key, value)
        await self.db.flush()
        await self.db.refresh(content_item)
        return content_item

    async def count_by_workspace_and_status(
        self, workspace_id: int, status: ContentStatus
    ) -> int:
        """Количество элементов по статусу (для dashboard stats)."""
        query = (
            select(func.count())
            .select_from(ContentItem)
            .filter(ContentItem.workspace_id == workspace_id)
            .filter(ContentItem.status == status)
            .filter(ContentItem.deleted_at.is_(None))
        )
        result = await self.db.execute(query)
        return result.scalar_one()
```

**Коммит:** `feat(content): add content repository with filtering and search`

---

## Chunk 5: YouTube metadata parser (yt-dlp)

**Цель:** Модуль для извлечения метаданных YouTube через yt-dlp. БЕЗ скачивания видео.

**Файлы:**
```
app/services/parsers/__init__.py
app/services/parsers/youtube.py
app/services/parsers/base.py
```

**Что делает:**

1. `parsers/base.py` — базовый интерфейс:
   ```python
   from dataclasses import dataclass

   @dataclass
   class ParsedMetadata:
       title: str
       description: str | None
       thumbnail_url: str | None
       duration_seconds: int | None
       channel_name: str | None
       channel_url: str | None
       view_count: int | None
       like_count: int | None
       upload_date: date | None
       video_id: str
       tags: list[str]

   class BaseParser:
       """Базовый класс парсера. Каждый тип контента — свой парсер."""
       def parse(self, url: str) -> ParsedMetadata:
           raise NotImplementedError
   ```

2. `parsers/youtube.py`:
   ```python
   import yt_dlp
   from datetime import date

   class YouTubeParser(BaseParser):
       """Парсер метаданных YouTube через yt-dlp."""

       YDL_OPTS = {
           "quiet": True,
           "no_warnings": True,
           "extract_flat": False,
           "skip_download": True,        # НЕ скачиваем видео
           "no_check_certificates": False,
           "socket_timeout": 30,
           "noplaylist": True,           # КРИТИЧНО: только одно видео, игнорировать плейлист
           "playlist_items": "1",        # страховка: если noplaylist не сработает
           "cachedir": False,            # НЕ писать кэш на диск
           "no_color": True,             # без ANSI-escape в логах worker'а
       }

       def parse(self, url: str) -> ParsedMetadata:
           with yt_dlp.YoutubeDL(self.YDL_OPTS) as ydl:
               info = ydl.extract_info(url, download=False)

           upload_date = None
           if info.get("upload_date"):
               try:
                   upload_date = date(
                       int(info["upload_date"][:4]),
                       int(info["upload_date"][4:6]),
                       int(info["upload_date"][6:8]),
                   )
               except (ValueError, IndexError):
                   pass

           return ParsedMetadata(
               title=info.get("title", ""),
               description=info.get("description"),
               thumbnail_url=info.get("thumbnail"),
               duration_seconds=info.get("duration"),
               channel_name=info.get("uploader") or info.get("channel"),
               channel_url=info.get("uploader_url") or info.get("channel_url"),
               view_count=info.get("view_count"),
               like_count=info.get("like_count"),
               upload_date=upload_date,
               video_id=info["id"],
               tags=info.get("tags", []),
           )

       @staticmethod
       def extract_video_id(url: str) -> str | None:
           """Извлечь video_id из URL без обращения к YouTube."""
           import re
           patterns = [
               r"(?:v=|/v/|youtu\.be/|/shorts/)([a-zA-Z0-9_-]{11})",
           ]
           for pattern in patterns:
               match = re.search(pattern, url)
               if match:
                   return match.group(1)
           return None
   ```

   **Ключевые решения:**
   - `skip_download=True` — только метаданные, не скачиваем видео/аудио
   - `socket_timeout=30` — таймаут на запрос
   - `extract_video_id` — быстрое извлечение ID из URL без сетевого запроса (для проверки дубликатов ДО запуска Celery)
   - yt-dlp вызывается СИНХРОННО (он сам блокирующий), поэтому запуск только в Celery worker

**Проверка:**
```python
from app.services.parsers.youtube import YouTubeParser
parser = YouTubeParser()
meta = parser.parse("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
print(meta.title, meta.channel_name, meta.duration_seconds)
```

**Коммит:** `feat(content): add YouTube metadata parser with yt-dlp`

---

## Chunk 6: Celery task — parse_content

**Цель:** Celery task, который парсит метаданные и обновляет ContentItem в БД.

**Файлы:**
```
app/worker/tasks/parse_content.py
app/worker/tasks/__init__.py       (обновить)
app/worker/db.py                   (sync session для worker)
```

**Что делает:**

1. `worker/db.py` — **синхронная** сессия для Celery worker:
   ```python
   from sqlalchemy import create_engine
   from sqlalchemy.orm import sessionmaker, Session
   from app.config import get_settings

   settings = get_settings()

   # Celery worker использует СИНХРОННЫЙ движок
   # (yt-dlp блокирующий, нет смысла в async)
   sync_engine = create_engine(
       settings.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://"),
       pool_size=5,
       max_overflow=10,
   )

   SyncSessionLocal = sessionmaker(bind=sync_engine, class_=Session)
   ```
   **Важно:** Worker НЕ использует async. yt-dlp — блокирующий, Celery worker работает в prefork mode. Отдельный sync engine.

   **Зависимость:** Добавить `psycopg2-binary >= 2.9.0` в `pyproject.toml`.

2. `worker/tasks/parse_content.py`:
   ```python
   from celery.exceptions import SoftTimeLimitExceeded

   from app.worker.celery_app import celery_app
   from app.worker.db import SyncSessionLocal
   from app.models.content_item import ContentItem, ContentStatus
   from app.services.parsers.youtube import YouTubeParser

   MAX_RETRIES = 3

   @celery_app.task(
       bind=True,
       name="parse_content",
       max_retries=MAX_RETRIES,
       default_retry_delay=60,  # 60 секунд между retry
       acks_late=True,
       time_limit=300,           # SIGKILL через 5 минут (жёсткий предел)
       soft_time_limit=270,      # SoftTimeLimitExceeded через 4.5 мин (можно обработать)
   )
   def parse_content_task(self, content_item_id: int) -> dict:
       """
       Фоновая задача: парсинг метаданных контента по URL.

       1. Загрузить ContentItem из БД
       2. Установить статус PROCESSING
       3. Запустить парсер (yt-dlp)
       4. Обновить ContentItem метаданными
       5. Установить статус COMPLETED или FAILED
       """
       db = SyncSessionLocal()
       try:
           # 1. Загрузить item
           item = db.query(ContentItem).filter(
               ContentItem.id == content_item_id,
               ContentItem.deleted_at.is_(None),
           ).first()

           if not item:
               return {"status": "error", "message": f"ContentItem {content_item_id} not found"}

           # 2. PROCESSING
           item.status = ContentStatus.PROCESSING
           db.commit()

           # 3. Парсинг
           parser = YouTubeParser()
           metadata = parser.parse(str(item.original_url))

           # 4. Обновить метаданные
           item.title = metadata.title
           item.description = metadata.description
           item.thumbnail_url = metadata.thumbnail_url
           item.duration_seconds = metadata.duration_seconds
           item.channel_name = metadata.channel_name
           item.channel_url = metadata.channel_url
           item.view_count = metadata.view_count
           item.like_count = metadata.like_count
           item.upload_date = metadata.upload_date
           item.video_id = metadata.video_id
           item.tags = metadata.tags

           # 5. COMPLETED
           item.status = ContentStatus.COMPLETED
           item.error_message = None
           db.commit()

           return {"status": "completed", "content_item_id": content_item_id, "title": metadata.title}

       except SoftTimeLimitExceeded:
           # Таймаут — yt-dlp завис. Помечаем как FAILED без retry.
           db.rollback()
           try:
               item = db.query(ContentItem).filter(ContentItem.id == content_item_id).first()
               if item:
                   item.status = ContentStatus.FAILED
                   item.error_message = "Timeout: парсинг занял слишком много времени"
                   db.commit()
           except Exception:
               db.rollback()
           return {"status": "failed", "content_item_id": content_item_id, "error": "timeout"}

       except Exception as exc:
           db.rollback()

           # Обновить retry_count и error
           try:
               item = db.query(ContentItem).filter(ContentItem.id == content_item_id).first()
               if item:
                   item.retry_count += 1
                   item.error_message = str(exc)[:500]

                   if self.request.retries >= MAX_RETRIES:
                       item.status = ContentStatus.FAILED
                       db.commit()
                       return {"status": "failed", "content_item_id": content_item_id, "error": str(exc)}

                   db.commit()
           except Exception:
               db.rollback()

           # Retry с exponential backoff
           raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

       finally:
           db.close()
   ```

   **Ключевые решения:**
   - `bind=True` — доступ к `self` для retry
   - `acks_late=True` — задача подтверждается ПОСЛЕ выполнения (при crash worker'а — retry)
   - Retry с exponential backoff: 60s, 120s, 240s
   - `error_message` обрезается до 500 символов
   - Синхронный SQLAlchemy — yt-dlp блокирующий, async не даёт преимуществ
   - PROCESSING ставится ДО парсинга — фронт видит прогресс

**Коммит:** `feat(content): add Celery task for YouTube metadata parsing`

---

## Chunk 7: Content service

**Цель:** Бизнес-логика добавления и управления контентом.

**Файлы:**
```
app/services/content_service.py
app/services/__init__.py           (обновить)
```

**Что делает:**

```python
# app/services/content_service.py

class ContentService:
    def __init__(self, db: AsyncSession, redis: Redis | None = None):
        self.db = db
        self.redis = redis
        self.content_repo = ContentRepository(db)

    async def add_content(
        self,
        workspace_id: int,
        user_id: int,
        url: str,
    ) -> ContentItem:
        """
        Добавить контент по URL.

        1. Определить тип контента по URL
        2. Извлечь video_id (быстро, без сети)
        3. Проверить дубликат в воркспейсе
        4. Создать ContentItem (status=PENDING)
        5. Отправить Celery task
        6. Сохранить celery_task_id
        """
        # 1. Определить тип
        content_type = self._detect_content_type(url)
        if not content_type:
            raise AppException(status_code=400, detail="Неподдерживаемый тип контента")

        # 2. Извлечь video_id
        video_id = None
        if content_type == ContentType.YOUTUBE_VIDEO:
            video_id = YouTubeParser.extract_video_id(url)

        # 3. Проверить дубликат
        if video_id:
            existing = await self.content_repo.get_by_video_id_in_workspace(
                workspace_id, video_id
            )
            if existing:
                raise ConflictException(
                    detail=f"Это видео уже добавлено в воркспейс (ID: {existing.id})"
                )

        # 4. Создать ContentItem
        item = await self.content_repo.create(
            workspace_id=workspace_id,
            added_by_user_id=user_id,
            original_url=url,
            content_type=content_type,
            status=ContentStatus.PENDING,
            video_id=video_id,
        )
        await self.db.commit()

        # 5. Отправить Celery task
        from app.worker.tasks.parse_content import parse_content_task
        task = parse_content_task.delay(item.id)

        # 6. Сохранить task_id
        item.celery_task_id = task.id
        await self.db.commit()

        return item

    async def get_content(
        self, workspace_id: int, content_id: int
    ) -> ContentItem:
        """Получить один элемент контента."""
        item = await self.content_repo.get_by_workspace_and_id(workspace_id, content_id)
        if not item:
            raise NotFoundException(detail="Контент не найден")
        return item

    async def list_content(
        self,
        workspace_id: int,
        pagination: PaginationParams,
        status: str | None = None,
        content_type: str | None = None,
        search: str | None = None,
    ) -> PaginatedResponse:
        """Список контента с фильтрацией."""
        status_enum = ContentStatus(status) if status else None
        type_enum = ContentType(content_type) if content_type else None

        return await self.content_repo.get_by_workspace(
            workspace_id=workspace_id,
            pagination=pagination,
            status=status_enum,
            content_type=type_enum,
            search=search,
        )

    async def delete_content(
        self, workspace_id: int, content_id: int
    ) -> None:
        """Soft delete контента."""
        item = await self.get_content(workspace_id, content_id)

        # Отменить Celery task если ещё в обработке
        if item.status in (ContentStatus.PENDING, ContentStatus.PROCESSING) and item.celery_task_id:
            from app.worker.celery_app import celery_app
            celery_app.control.revoke(item.celery_task_id, terminate=True)

        await self.content_repo.soft_delete(item)
        await self.db.commit()

    async def retry_content(
        self, workspace_id: int, content_id: int
    ) -> ContentItem:
        """Повторить парсинг для FAILED контента."""
        item = await self.get_content(workspace_id, content_id)

        if item.status != ContentStatus.FAILED:
            raise AppException(
                status_code=400,
                detail="Повторить можно только для контента со статусом FAILED"
            )

        # Сбросить статус и retry_count
        item.status = ContentStatus.PENDING
        item.error_message = None
        item.retry_count = 0
        await self.db.flush()
        await self.db.commit()

        # Отправить новый task
        from app.worker.tasks.parse_content import parse_content_task
        task = parse_content_task.delay(item.id)

        item.celery_task_id = task.id
        await self.db.commit()

        return item

    @staticmethod
    def _detect_content_type(url: str) -> ContentType | None:
        """Определить тип контента по URL (через urlparse, без regex — R3/R8 fix)."""
        from urllib.parse import urlparse
        from app.schemas.content import YOUTUBE_ALLOWED_HOSTS

        parsed = urlparse(url)
        if parsed.hostname in YOUTUBE_ALLOWED_HOSTS:
            return ContentType.YOUTUBE_VIDEO
        return None
```

**Ключевые решения:**
- `extract_video_id` вызывается ДО создания записи — быстрая проверка дубликатов без сетевого запроса
- `celery_task_id` сохраняется для возможности отмены
- `retry_content` — ручной retry для FAILED элементов
- `delete_content` — при удалении отменяет Celery task
- Import Celery tasks внутри методов — избегаем circular imports

**Коммит:** `feat(content): add content service with add/list/delete/retry`

---

## Chunk 8: Content API router

**Цель:** REST API эндпоинты для управления контентом.

**Файлы:**
```
app/api/content.py
app/api/router.py                  (обновить: подключить content router)
app/dependencies.py                (обновить: если нужны новые deps)
```

**Что делает:**

```python
# app/api/content.py

router = APIRouter(prefix="/workspaces/{workspace_id}/content", tags=["content"])


@router.post(
    "",
    response_model=ContentItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_content(
    workspace_id: int,
    body: AddContentRequest,
    user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
):
    """Добавить контент по URL. Парсинг запускается в фоне."""
    workspace, member = workspace_ctx
    require_role_check(member, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR, WorkspaceRole.CONTRACTOR])

    service = ContentService(db)
    item = await service.add_content(
        workspace_id=workspace.id,
        user_id=user.id,
        url=str(body.url),
    )
    return item


@router.get(
    "",
    response_model=PaginatedResponse,  # items: list[ContentItemShortResponse]
)
async def list_content(
    workspace_id: int,
    pagination: PaginationParams = Depends(),
    status_filter: str | None = Query(None, alias="status"),
    content_type: str | None = Query(None),
    search: str | None = Query(None),
    user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
):
    """Список контента в воркспейсе с фильтрацией и пагинацией."""
    workspace, member = workspace_ctx

    service = ContentService(db)
    return await service.list_content(
        workspace_id=workspace.id,
        pagination=pagination,
        status=status_filter,
        content_type=content_type,
        search=search,
    )


@router.get(
    "/{content_id}",
    response_model=ContentItemResponse,
)
async def get_content(
    workspace_id: int,
    content_id: int,
    user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
):
    """Получить детали контента."""
    workspace, member = workspace_ctx

    service = ContentService(db)
    return await service.get_content(workspace.id, content_id)


@router.delete(
    "/{content_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_content(
    workspace_id: int,
    content_id: int,
    user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
):
    """Удалить контент (soft delete). Отменяет фоновый парсинг."""
    workspace, member = workspace_ctx
    require_role_check(member, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR])

    service = ContentService(db)
    await service.delete_content(workspace.id, content_id)


@router.post(
    "/{content_id}/retry",
    response_model=ContentItemResponse,
)
async def retry_content(
    workspace_id: int,
    content_id: int,
    user: User = Depends(get_current_user),
    workspace_ctx: tuple[Workspace, WorkspaceMember] = Depends(get_workspace_from_path),
    db: AsyncSession = Depends(get_db),
):
    """Повторить парсинг для контента со статусом FAILED."""
    workspace, member = workspace_ctx
    require_role_check(member, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR])

    service = ContentService(db)
    return await service.retry_content(workspace.id, content_id)
```

**Эндпоинты:**

| Метод | Путь | Роли | Описание |
|-------|------|------|----------|
| `POST` | `/workspaces/{id}/content` | owner/admin/editor/contractor | Добавить контент по URL |
| `GET` | `/workspaces/{id}/content` | все members | Список контента (paginated) |
| `GET` | `/workspaces/{id}/content/{cid}` | все members | Детали контента |
| `DELETE` | `/workspaces/{id}/content/{cid}` | owner/admin/editor | Удалить контент |
| `POST` | `/workspaces/{id}/content/{cid}/retry` | owner/admin/editor | Повторить парсинг |

**Решения:**
- URL вложен в workspace: `/workspaces/{id}/content` — мультитенантность через URL path (как members в Sprint 1)
- Contractor может добавлять, но НЕ может удалять — бизнес-правило
- `GET /content` — доступен ВСЕМ members (включая viewer)
- `status` как query param → `?status=completed`
- `search` → ilike по title и channel_name

**Коммит:** `feat(content): add content API endpoints`

---

## Chunk 9: Обновить docker-compose + .env + health check

**Цель:** Celery worker и Flower (мониторинг) в docker-compose, health check проверяет Celery.

**Файлы:**
```
docker-compose.yml                 (обновить)
.env.example                       (обновить)
app/api/health.py                  (обновить: добавить celery check)
```

**Что делает:**

1. `docker-compose.yml` — добавить:
   ```yaml
   celery-worker:
     build: .
     command: celery -A app.worker.celery_app worker --loglevel=info --concurrency=2
     volumes:
       - .:/code
     env_file:
       - .env
     depends_on:
       - redis
       - postgres
     restart: unless-stopped

   celery-flower:
     build: .
     command: celery -A app.worker.celery_app flower --port=5555
     ports:
       - "5555:5555"
     env_file:
       - .env
     depends_on:
       - redis
       - celery-worker
     restart: unless-stopped
     profiles:
       - monitoring
   ```
   **Flower** — веб-UI для мониторинга Celery tasks. Доступен по `http://localhost:5555`. Включён в profile `monitoring` (не запускается по дефолту, `docker-compose --profile monitoring up`).

2. `health.py` — расширить:
   ```python
   # Добавить проверку Celery broker
   try:
       celery_status = celery_app.control.ping(timeout=2)
       health["celery"] = "ok" if celery_status else "unavailable"
   except Exception:
       health["celery"] = "unavailable"
   ```

3. `.env.example` — добавить celery переменные.

**Коммит:** `infra: add Celery worker and Flower to docker-compose`

---

## Chunk 10: Тесты

**Цель:** Тесты покрывают content API, парсер, Celery tasks.

**Файлы:**
```
tests/conftest.py                  (обновить: content fixtures)
tests/test_content.py
tests/test_youtube_parser.py
```

**Что делает:**

1. `conftest.py` — добавить:
   - `workspace_with_auth` — auth headers + workspace_id
   - `content_item` — готовый ContentItem в статусе COMPLETED

2. `test_content.py` — API тесты:
   - `test_add_content_youtube_url` — 201, status=pending
   - `test_add_content_invalid_url` — 422 (не YouTube)
   - `test_add_content_duplicate_video` — 409
   - `test_list_content_empty` — 200, пустой список
   - `test_list_content_with_items` — 200, paginated
   - `test_list_content_filter_by_status` — ?status=completed
   - `test_list_content_search` — ?search=keyword
   - `test_get_content_detail` — 200
   - `test_get_content_not_found` — 404
   - `test_get_content_wrong_workspace` — 404 (мультитенантность)
   - `test_delete_content` — 204
   - `test_retry_content_failed` — 200, status reset to pending
   - `test_retry_content_not_failed` — 400
   - `test_add_content_viewer_forbidden` — 403

3. `test_youtube_parser.py` — unit тесты парсера:
   - `test_extract_video_id_standard_url`
   - `test_extract_video_id_short_url`
   - `test_extract_video_id_shorts_url`
   - `test_extract_video_id_invalid` → None
   - `test_parse_metadata` — mock yt-dlp, проверить маппинг полей

   **Важно:** Для `test_parse_metadata` — мокаем `yt_dlp.YoutubeDL` через `unittest.mock.patch`, чтобы тесты не ходили в сеть.

**Проверка:** `pytest tests/test_content.py tests/test_youtube_parser.py -v`

**Коммит:** `test(content): add content API and YouTube parser tests`

---

## Checklist — после всех chunks

```bash
# Инфра
docker-compose up -d
docker-compose ps              # postgres, redis, celery-worker — running

# Миграции
alembic upgrade head

# Сервер
uvicorn app.main:app --reload --port 8000

# Worker (отдельный терминал)
celery -A app.worker.celery_app worker --loglevel=info

# Качество
ruff check . && ruff format .
pyrefly check .

# Тесты
pytest -v --cov=app

# Ручная проверка
curl -X POST http://localhost:8000/api/v1/workspaces/1/content \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
# → 201, status: "pending"

# Через 5-10 секунд
curl http://localhost:8000/api/v1/workspaces/1/content/1 \
  -H "Authorization: Bearer <token>"
# → 200, status: "completed", title: "Rick Astley - Never Gonna Give You Up"
```

---

## Ожидаемый результат после Sprint 2

### Новые эндпоинты

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/workspaces/{id}/content` | Bearer + editor+ | Добавить контент по URL |
| `GET` | `/api/v1/workspaces/{id}/content` | Bearer + member | Список контента (paginated) |
| `GET` | `/api/v1/workspaces/{id}/content/{cid}` | Bearer + member | Детали контента |
| `DELETE` | `/api/v1/workspaces/{id}/content/{cid}` | Bearer + editor+ | Удалить контент |
| `POST` | `/api/v1/workspaces/{id}/content/{cid}/retry` | Bearer + editor+ | Повторить парсинг |

### Новые таблицы

```
content_items (
    id, workspace_id, added_by_user_id,
    original_url, content_type, status, error_message, retry_count, celery_task_id,
    title, description, thumbnail_url, duration_seconds,
    channel_name, channel_url, view_count, like_count, upload_date,
    video_id, tags,
    created_at, updated_at, deleted_at
)
```

### Новые файлы

```
app/
├── worker/
│   ├── __init__.py
│   ├── celery_app.py              # Celery конфигурация
│   ├── db.py                      # Sync session для worker
│   └── tasks/
│       ├── __init__.py
│       └── parse_content.py       # Task: парсинг метаданных
├── models/
│   └── content_item.py            # ContentItem, ContentStatus, ContentType
├── schemas/
│   └── content.py                 # Request/Response схемы
├── repositories/
│   └── content_repository.py      # Data access
├── services/
│   ├── content_service.py         # Бизнес-логика
│   └── parsers/
│       ├── __init__.py
│       ├── base.py                # ParsedMetadata, BaseParser
│       └── youtube.py             # YouTubeParser (yt-dlp)
├── api/
│   └── content.py                 # REST API endpoints
tests/
├── test_content.py                # API тесты
└── test_youtube_parser.py         # Unit тесты парсера
```

### Новые зависимости

```
celery[redis] >= 5.4.0
yt-dlp >= 2024.12.0
psycopg2-binary >= 2.9.0
flower >= 2.0.0 (optional, dev)
```

---

## Риски и дыры

> Полный аудит плана. Риски упорядочены по severity.

---

### КРИТИЧНЫЕ — сломают продакшен если не решить

#### R1. Нет общего timeout на Celery task — worker зависнет навсегда

`socket_timeout=30` покрывает ТОЛЬКО отдельные socket-операции. Если yt-dlp застрянет в JS-интерпретаторе (извлечение сигнатуры), redirect-петле, или YouTube вернёт бесконечный chunked response — задача зависнет навсегда. Worker-слот заблокирован. При `concurrency=2` — два зависших task'а = мёртвый worker.

**Решение:** Добавить в декоратор задачи:
```python
@celery_app.task(
    ...
    time_limit=120,           # SIGKILL через 120с (жёсткий)
    soft_time_limit=90,       # SoftTimeLimitExceeded через 90с (можно обработать)
)
```
В теле задачи — поймать `SoftTimeLimitExceeded`, установить FAILED, записать error_message = "Timeout: парсинг занял слишком много времени".

#### R2. Плейлисты и каналы — OOM и бесконечная обработка

URL `youtube.com/watch?v=xxx&list=PLyyy` проходит regex-валидацию. yt-dlp по дефолту **извлекает весь плейлист** — сотни видео. `extract_info()` вернёт гигантский dict, worker сожрёт память и CPU.

Аналогично: `youtube.com/channel/UCxxx`, `youtube.com/@username` — могут пройти через validator (если regex не строгий) и вызвать парсинг тысяч видео.

**Решение:** Обязательно в `YDL_OPTS`:
```python
"noplaylist": True,      # КРИТИЧНО: только одно видео, игнорировать плейлист
"playlist_items": "1",   # страховка: если noplaylist не сработает — только первый элемент
```

#### R3. SSRF через regex-валидацию URL

URL-валидация через `re.match` — ненадёжна. Примеры обхода:

```
https://youtube.com.attacker.com/watch?v=xxx     — НЕ пройдёт (/ vs .)
https://youtube.com%2Fattacker.com/watch?v=xxx   — URL-encoded slash, может пройти после декодирования
https://youtube.com:8080@attacker.com/watch?v=xxx — userinfo@ trick, host = attacker.com
```

yt-dlp получит подставной URL, сделает HTTP-запрос к `attacker.com` с внутренним IP сервера. Классический SSRF.

**Решение:** НЕ валидировать URL regex-ом. Парсить через `urllib.parse.urlparse()`, проверять `hostname`:
```python
from urllib.parse import urlparse

ALLOWED_HOSTS = {"youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"}

def validate_youtube_url(url: str) -> bool:
    parsed = urlparse(url)
    return (
        parsed.scheme in ("http", "https")
        and parsed.hostname in ALLOWED_HOSTS
    )
```
Regex оставить только для `extract_video_id` (не делает сетевых запросов).

#### R4. Нет rate limiting на POST /content — queue flood

Один пользователь может отправить 10000 запросов `POST /content` за минуту. Каждый создаёт запись в БД + Celery task. Результат: переполнение очереди Redis, worker загружен на часы, другие пользователи ждут.

**Решение (выбрать одно или оба):**
1. **Rate limit на эндпоинте:** максимум N добавлений в минуту на workspace (например 30/мин). Через Redis counter.
2. **Лимит PENDING items:** проверить `count_by_workspace_and_status(workspace_id, PENDING)`. Если > 50 — отказать (429 Too Many Requests, "Дождитесь обработки текущих элементов").

#### R5. Celery tasks не замоканы в тестах — тесты упадут или отправят реальные tasks

`add_content()` вызывает `parse_content_task.delay()`. В тестовом окружении:
- Если Redis не запущен → `ConnectionError`
- Если запущен → реальный task попадёт в очередь → попытается парсить YouTube

Ни мок Celery dispatch, ни `CELERY_ALWAYS_EAGER` не описаны в Chunk 10.

`CELERY_ALWAYS_EAGER` тоже не подойдёт: task использует **sync** SQLAlchemy session, а тесты используют **async** тестовую БД. Task не увидит данные из транзакции теста.

**Решение:** В `conftest.py` мокать `parse_content_task.delay`:
```python
@pytest.fixture(autouse=True)
def mock_celery_tasks(monkeypatch):
    mock_result = MagicMock()
    mock_result.id = "test-task-id-123"
    monkeypatch.setattr(
        "app.worker.tasks.parse_content.parse_content_task.delay",
        MagicMock(return_value=mock_result),
    )
```
Для тестов самого task'а — отдельные unit-тесты с sync тестовой БД.

---

### ДИЗАЙН — архитектурные дыры и противоречия

#### R6. Два коммита в `add_content` — race condition с worker'ом

```python
# Коммит 1: item в БД
item = await self.content_repo.create(...)
await self.db.commit()

# Celery task стартует МГНОВЕННО, worker уже читает item из БД
task = parse_content_task.delay(item.id)

# Коммит 2: сохраняем task_id (ПОСЛЕ того как worker мог уже завершить парсинг)
item.celery_task_id = task.id
await self.db.commit()
```

Проблема 1: между коммитами 1 и 2 worker может **завершить** парсинг. API-сервис держит stale ORM-объект. Второй `commit()` — SQLAlchemy запишет `celery_task_id`, но ORM-объект мог загрузить stale `status=PENDING` при первом коммите.

Проблема 2: если сервер падает между коммитом 1 и `task.delay()` — item навсегда в PENDING, task не отправлен.

**Решение:** Единственный безопасный вариант — разделить на два шага:
```python
item = await self.content_repo.create(...)
await self.db.commit()

task = parse_content_task.delay(item.id)

# UPDATE только celery_task_id, без загрузки объекта
await self.db.execute(
    update(ContentItem)
    .where(ContentItem.id == item.id)
    .values(celery_task_id=task.id)
)
await self.db.commit()
await self.db.refresh(item)
```
Для проблемы 2: описать в R11 periodic task, который подбирает "потерянные" PENDING items.

#### R7. Sync engine URL через string replace — хрупкое решение

```python
settings.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
```

Если `database_url` содержит `asyncpg` где-то в пароле или хосте — замена сломает URL. Если используется другой async-драйвер — молча вернёт оригинальный URL и worker упадёт с непонятной ошибкой.

**Решение:** Отдельная переменная в `Settings`:
```python
sync_database_url: str = "postgresql+psycopg2://app:app@localhost:5432/app_db"
```
Или вычислять программно:
```python
from sqlalchemy.engine import make_url
url = make_url(settings.database_url)
sync_url = url.set(drivername="postgresql+psycopg2")
```

#### R8. YouTube URL-паттерны дублируются в 3 местах — разойдутся

1. `schemas/content.py` → `AddContentRequest.validate_supported_url` — regex с `?v=[\w-]+`
2. `services/content_service.py` → `_detect_content_type` — regex без query params
3. `services/parsers/youtube.py` → `extract_video_id` — ещё один regex

Три разных regex-набора для одной задачи. При добавлении нового формата YouTube URL (например `youtube.com/live/ID`) — нужно обновить все три. Забудешь один — баг.

**Решение:** Один модуль `app/utils/url_utils.py`:
```python
def is_youtube_url(url: str) -> bool: ...
def extract_youtube_video_id(url: str) -> str | None: ...
```
Использовать ВЕЗДЕ. Schema-валидатор и `_detect_content_type` вызывают `is_youtube_url()`. Парсер вызывает `extract_youtube_video_id()`.

#### R9. `ContentFilterParams` — мёртвый код

Схема `ContentFilterParams` определена в Chunk 3, но нигде не используется. Router в Chunk 8 принимает query-параметры напрямую (`status_filter`, `content_type`, `search`).

**Решение:** Либо удалить `ContentFilterParams`, либо использовать его как `Depends()` в router'е.

#### R10. `revoke(terminate=True)` при удалении — опасно

`celery_app.control.revoke(task_id, terminate=True)` отправляет `SIGTERM` процессу worker'а (не task'у — Celery не может убить отдельный task в prefork mode). Если concurrency > 1 — **убивает весь worker process**, включая другие задачи в этом процессе.

Также: `acks_late=True` + `terminate` = убитая задача будет **переотправлена** (она не была acknowledged). Worker перезапускает процесс, берёт задачу снова, её снова revoke'ают — бесконечный цикл.

**Решение:**
1. Вместо `terminate=True` — использовать `revoke(task_id)` без terminate. Задача будет отклонена когда worker попытается её взять (если в PENDING в очереди). Если уже PROCESSING — пусть доработает.
2. Для PROCESSING-задач: в task'е проверять флаг `is_revoked`:
```python
if self.is_aborted():  # или проверить Redis-флаг
    item.status = ContentStatus.FAILED
    item.error_message = "Отменено пользователем"
    db.commit()
    return
```

#### R11. Periodic task для зависших items — упомянут, но не реализован

R-S2-3 говорит: "Celery beat для поиска зависших items". Но в 10 чанках **нет Celery beat**. Нет `celerybeat-schedule`. Нет periodic task. Items зависшие в `PROCESSING` после crash'а worker'а останутся навсегда.

Аналогично: items застрявшие в `PENDING` (task не отправлен из-за R6 проблемы 2) — никто не подберёт.

**Решение:** Добавить chunk или включить в существующий:
```python
# worker/tasks/cleanup.py
@celery_app.task(name="cleanup_stuck_items")
def cleanup_stuck_items():
    """Сбрасывает зависшие PROCESSING items в PENDING."""
    db = SyncSessionLocal()
    try:
        threshold = datetime.utcnow() - timedelta(minutes=10)
        stuck = db.query(ContentItem).filter(
            ContentItem.status == ContentStatus.PROCESSING,
            ContentItem.updated_at < threshold,
        ).all()
        for item in stuck:
            item.status = ContentStatus.PENDING
            item.error_message = "Перезапуск: предыдущая обработка зависла"
        db.commit()
    finally:
        db.close()

# celery_app.py
celery_app.conf.beat_schedule = {
    "cleanup-stuck-items": {
        "task": "cleanup_stuck_items",
        "schedule": 300.0,  # каждые 5 минут
    },
}
```
В `docker-compose.yml` — добавить `celery-beat` сервис.

---

### БЕЗОПАСНОСТЬ

#### R12. LIKE-wildcards в search не экранированы

```python
search_filter = f"%{search}%"
query = query.filter(ContentItem.title.ilike(search_filter))
```

Если `search = "%"` → `ilike "%%%"` → матчит ВСЁ. Если `search = "____"` → `_` = любой символ → матчит все 4+ символьные title.

Не SQL injection, но нарушение ожидаемого поведения и потенциально дорогой запрос.

**Решение:** Экранировать спецсимволы:
```python
def escape_like(s: str) -> str:
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

search_filter = f"%{escape_like(search)}%"
```

#### R13. `info["id"]` — KeyError при нестандартном ответе yt-dlp

```python
video_id=info["id"],  # KeyError если yt-dlp не вернул "id"
```

yt-dlp возвращает `None` для `id` при ошибках извлечения. Или может вернуть dict без ключа `id` при неожиданном формате страницы.

**Решение:** `info.get("id", "")` + валидация: если `video_id` пустой — считать парсинг неудачным.

#### R14. `psycopg2-binary` в production

`psycopg2-binary` содержит предкомпилированные бинарники, которые **не рекомендуются** для production (проблемы совместимости с системными библиотеками, SSL). Из документации psycopg2:

> "The binary package is a practical choice for development and testing but in production it is advised to use the package built from sources."

**Решение:** В production — `psycopg2` (компилируется из исходников, требует `libpq-dev`). В Docker — добавить `apt-get install -y libpq-dev` в Dockerfile. Или использовать `psycopg[binary]` (v3) — более современный.

---

### ОПЕРАЦИОННЫЕ

#### R15. yt-dlp пишет кэш на диск

Даже с `skip_download=True`, yt-dlp по дефолту создаёт кэш-директорию (`~/.cache/yt-dlp/`) и пишет туда кэш извлечённых данных. В Docker-контейнере при `restart: unless-stopped` кэш растёт бесконечно. В production-среде с read-only filesystem — crash.

**Решение:** Добавить в `YDL_OPTS`:
```python
"cachedir": False,          # НЕ создавать кэш-директорию
"no_color": True,           # без ANSI-escape в логах
```

#### R16. Result backend хранит результаты, но никто их не читает

`celery_result_backend` настроен, task возвращает `dict`. Результаты хранятся в Redis index 2 по 1 час (`result_expires=3600`). Но ни API, ни фронтенд НЕ читают результаты — статус берётся из БД.

Redis index 2 расходует память впустую.

**Решение:** Либо `ignore_result=True` в декораторе task'а (рекомендуется), либо убрать `result_backend` из конфига. Если в будущем понадобится — вернуть.

#### R17. Worker без structured logging

FastAPI-приложение использует structlog (logging_config.py). Worker использует стандартный Celery logging. Две разные системы логов, разные форматы. В production при агрегации логов (ELK/Loki) — хаос.

**Решение:** Настроить structlog для Celery worker:
```python
# worker/celery_app.py
from celery.signals import setup_logging

@setup_logging.connect
def configure_worker_logging(**kwargs):
    from app.logging_config import setup_logging
    setup_logging()
```

#### R18. `extract_video_id` regex пропускает форматы

Текущий regex: `(?:v=|/v/|youtu\.be/|/shorts/)([a-zA-Z0-9_-]{11})`

Пропущенные форматы:
- `youtube.com/embed/VIDEO_ID` — embed-ссылки
- `youtube.com/live/VIDEO_ID` — прямые трансляции
- `m.youtube.com/watch?v=VIDEO_ID` — мобильные ссылки (m. sub-domain)
- `youtube.com/watch?v=VIDEO_ID&t=120` — с timestamp, `[\w-]+` в schema не захватит `&`... нет, `[\w-]` остановится на `&`, ОК
- `youtube.com/watch?feature=share&v=VIDEO_ID` — `v=` не первый параметр → regex `\?v=` не сматчит

**Решение:** Расширить regex:
```python
patterns = [
    r"(?:v=|/v/|youtu\.be/|/shorts/|/embed/|/live/)([a-zA-Z0-9_-]{11})",
]
```
И для URL-валидации — парсить query params через `urllib.parse.parse_qs` для надёжного извлечения `v=`:
```python
from urllib.parse import urlparse, parse_qs
parsed = urlparse(url)
qs = parse_qs(parsed.query)
video_id = qs.get("v", [None])[0]
```

#### R19. Каскад при soft delete workspace → content_items не определён

Sprint 1 R7 поднял проблему каскадного поведения при soft delete. Sprint 2 **усугубляет** её: теперь workspace содержит content_items. При soft delete workspace:
- `GET /workspaces/{id}/content` — workspace deleted, но content_items нет. Что вернёт?
- Worker заканчивает парсинг для deleted workspace — лишняя работа
- `list_content` фильтрует `workspace_id`, но не проверяет `workspace.deleted_at`

**Решение:** Определить чётко:
1. При soft delete workspace — мягко удалить все content_items (batch UPDATE `deleted_at`)
2. Или: в `get_workspace_from_path` (dependency) — уже проверяется что workspace не deleted. Если да — 404. Контент "осиротевший" но доступ через API невозможен. Достаточно для Sprint 2.

Решение 2 проще, но оставляет мусор в БД. Задокументировать как known limitation.

---

### ПРОБЕЛЫ — что забыли

#### R20. Retryable vs permanent errors не различаются

Текущая логика: любая ошибка → retry → retry → retry → FAILED.

Но ошибки бывают разные:
- **Retryable:** 429 Too Many Requests, сетевой таймаут, 503 Service Unavailable
- **Permanent:** видео удалено (404), видео приватное, возрастное ограничение, регион заблокирован, невалидный video_id

При permanent-ошибке retry бесполезен — 3 попытки × 60-240с задержки = ~6 минут впустую загружают worker.

**Решение:** Классифицировать ошибки yt-dlp:
```python
PERMANENT_ERRORS = [
    "Video unavailable",
    "Private video",
    "This video has been removed",
    "Sign in to confirm your age",
    "is not available",
]

try:
    metadata = parser.parse(url)
except yt_dlp.utils.DownloadError as exc:
    error_str = str(exc)
    if any(marker in error_str for marker in PERMANENT_ERRORS):
        item.status = ContentStatus.FAILED
        item.error_message = f"Постоянная ошибка: {error_str[:500]}"
        db.commit()
        return {"status": "failed", "permanent": True}
    raise  # retryable — уйдёт в retry
```

#### R21. Нет эндпоинта для статистики / batch-статусов

Фронт должен показывать прогресс: "5 из 12 обработано". Текущий API требует загрузить ВСЮ страницу контента и считать статусы на клиенте.

**Решение:** Добавить эндпоинт:
```
GET /workspaces/{id}/content/stats → { total, pending, processing, completed, failed }
```
Использует уже написанный `count_by_workspace_and_status`. Лёгкий запрос, полезный для dashboard.

#### R22. `tags: Mapped[list | None]` — JSON вместо JSONB, нет типизации

1. `JSON` в PostgreSQL — хранится как текст, каждый запрос парсит заново. **JSONB** — бинарный формат, поддерживает индексы, быстрее для чтения.
2. `Mapped[list | None]` — SQLAlchemy не валидирует тип. Можно записать `dict`, `str`, `int`. Модель не падёт — в БД окажется мусор.

**Решение:**
```python
from sqlalchemy.dialects.postgresql import JSONB

tags: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
```

#### R23. Нет bulk-добавления контента

Пользователь хочет добавить 20 ссылок — 20 отдельных HTTP-запросов. Медленно, нагружает сеть.

**Решение (Sprint 2+ или Sprint 3):** Добавить `POST /workspaces/{id}/content/batch`:
```python
class AddContentBatchRequest(BaseModel):
    urls: list[HttpUrl] = Field(max_length=50)  # максимум 50 за раз
```
Возвращает список `{url, status, content_id?, error?}`. Не блокирующий: создаёт items и Celery tasks для каждого. Можно отложить, но стоит предусмотреть в API-дизайне.

#### R24. Alembic не управляет PostgreSQL enum'ами при будущих изменениях

`SAEnum(ContentType, ...)` создаёт PostgreSQL enum type `content_type_enum`. Когда в Sprint 3 добавится `INSTAGRAM_POST`:
- Alembic autogenerate **не умеет** добавлять значения в существующий enum
- Нужен ручной `op.execute("ALTER TYPE content_type_enum ADD VALUE 'instagram_post'")`
- ALTER TYPE ... ADD VALUE **нельзя** выполнить внутри транзакции (PostgreSQL < 12: нельзя вообще; PostgreSQL 12+: можно, но с ограничениями)

**Решение:** Документировать для будущих спринтов. Или использовать `String` вместо SQLAlchemy Enum и валидировать на уровне Pydantic. Enum в Python, `String(50)` в БД — проще для миграций.

---

### Матрица приоритетов

| # | Риск | Severity | Когда решать |
|---|------|----------|--------------|
| R1 | ~~Нет task timeout — worker зависает~~ | ~~CRITICAL~~ | **RESOLVED** — time_limit=300, soft_time_limit=270 |
| R2 | ~~Плейлисты/каналы — OOM~~ | ~~CRITICAL~~ | **RESOLVED** — noplaylist=True, playlist_items="1" |
| R3 | ~~SSRF через regex URL-валидацию~~ | ~~CRITICAL~~ | **RESOLVED** — urlparse + YOUTUBE_ALLOWED_HOSTS |
| R4 | Нет rate limit — queue flood | **HIGH** | Chunk 8 |
| R5 | Celery не замокан в тестах | **HIGH** | Chunk 10 |
| R6 | Два коммита — race condition с worker | **HIGH** | Chunk 7 |
| R7 | String replace для sync DB URL | **HIGH** | Chunk 6 |
| R8 | URL-паттерны в 3 местах — разойдутся | **HIGH** | Chunk 3 + 5 + 7 |
| R10 | `revoke(terminate=True)` — убивает worker | **HIGH** | Chunk 7 |
| R11 | Periodic task не реализован | **HIGH** | Новый chunk или Chunk 9 |
| R20 | Permanent vs retryable errors | **HIGH** | Chunk 6 |
| R12 | LIKE wildcards не экранированы | **MEDIUM** | Chunk 4 |
| R13 | `info["id"]` — KeyError | **MEDIUM** | Chunk 5 |
| R15 | yt-dlp кэш на диск | **MEDIUM** | Chunk 5 |
| R16 | Result backend впустую | **MEDIUM** | Chunk 1 |
| R18 | extract_video_id пропускает форматы | **MEDIUM** | Chunk 5 |
| R19 | Каскад workspace → content | **MEDIUM** | Chunk 7 или Chunk 9 |
| R22 | JSON vs JSONB, типизация tags | **MEDIUM** | Chunk 2 |
| R24 | Alembic + PostgreSQL enum | **MEDIUM** | Документировать |
| R9 | ContentFilterParams — мёртвый код | **LOW** | Chunk 3 |
| R14 | psycopg2-binary в production | **LOW** | Chunk 6 |
| R17 | Worker без structlog | **LOW** | Chunk 9 |
| R21 | Нет /content/stats | **LOW** | Sprint 3 |
| R23 | Нет batch-добавления | **LOW** | Sprint 3 |

---

## Итого: 10 chunks, 10 коммитов, ~15 новых файлов, 24 идентифицированных риска
