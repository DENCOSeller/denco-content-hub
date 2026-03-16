# Chunks — Sprint 3 Implementation

Каждый chunk — атомарная единица работы. Выполняются строго по порядку (кроме 3+4 — параллельно).
После каждого chunk: `ruff check . && ruff format .` + `pyrefly check .` + коммит.

---

## Граф зависимостей

```
Chunk 1 (config + deps)
    ↓
Chunk 2 (model + migration)
    ↓
    ├→ Chunk 3 (download_audio integration)    ← параллельно
    └→ Chunk 4 (whisper integration)           ← параллельно
    ↓
Chunk 5 (refactor parse_content → parse_metadata)
    ↓
Chunk 6 (download_audio task)
    ↓
Chunk 7 (transcribe_content task)
    ↓
Chunk 8 (repository + service)
    ↓
Chunk 9 (schemas + API)
    ↓
Chunk 10 (content_service: delete/retry)
    ↓
Chunk 11 (recovery task)
    ↓
Chunk 12 (tests)
    ↓
Chunk 13 (deploy)
```

---

## Chunk 1: Config + Dependencies

**Цель:** Инфраструктура для Whisper + audio pipeline.

**Файлы (изменяемые):**
```
app/config.py
app/worker/celery_app.py
app/worker/db.py
pyproject.toml
```

**Что делать:**

1. `app/config.py` — добавить в Settings:
   ```python
   whisper_model_size: str = "small"              # tiny/base/small/medium/large
   audio_storage_path: str = "/var/denco/audio"   # НЕ /tmp
   max_video_duration_minutes: int = 180          # лимит 3 часа
   ```

2. `pyproject.toml` — добавить:
   ```
   openai-whisper >= 20231117
   ```
   > torch (~2 GB) подтянется автоматически. Долгий `pip install`.

3. `app/worker/celery_app.py` — добавить:
   - task_routes:
     ```python
     celery_app.conf.task_routes = {
         "parse_metadata": {"queue": "default"},
         "download_audio": {"queue": "default"},
         "transcribe_content": {"queue": "transcription"},
     }
     ```
   - Проверка ffmpeg при старте воркера:
     ```python
     from celery.signals import worker_ready

     @worker_ready.connect
     def check_ffmpeg_available(**kwargs):
         import shutil
         if not shutil.which("ffmpeg"):
             raise RuntimeError("ffmpeg not found. Install: apt install ffmpeg")
     ```

4. `app/worker/db.py` — увеличить пул:
   ```python
   pool_size=10,      # было 5
   max_overflow=20,   # было 10
   ```

**Проверка:** `ruff check . && ruff format .`, `pyrefly check .`, `pip install -e ".[dev]"` проходит.

**Коммит:** `feat(transcription): add whisper config, deps, celery queue routing`

---

## Chunk 2: Transcription Model + Migration

**Цель:** Таблица `transcriptions` в БД, новый статус `DOWNLOADING` в ContentItem.

**Новые файлы:**
```
app/models/transcription.py
```

**Изменяемые файлы:**
```
app/models/content_item.py
app/models/__init__.py
migrations/versions/xxx_add_transcriptions_and_downloading_status.py
```

**Что делать:**

1. `app/models/transcription.py`:
   ```python
   class TranscriptionStatus(enum.StrEnum):
       PENDING = "pending"
       PROCESSING = "processing"
       COMPLETED = "completed"
       FAILED = "failed"

   class Transcription(Base, TimestampMixin):
       __tablename__ = "transcriptions"

       id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
       content_item_id: Mapped[int] = mapped_column(
           ForeignKey("content_items.id"), nullable=False
       )
       status: Mapped[TranscriptionStatus] = mapped_column(
           default=TranscriptionStatus.PENDING, nullable=False
       )
       text: Mapped[str | None] = mapped_column(Text, nullable=True)
       language: Mapped[str | None] = mapped_column(String(10), nullable=True)
       duration_seconds: Mapped[int | None] = mapped_column(nullable=True)
       whisper_model: Mapped[str | None] = mapped_column(String(20), nullable=True)
       error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
       retry_count: Mapped[int] = mapped_column(default=0, nullable=False)
       celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

       # Relationship
       content_item: Mapped["ContentItem"] = relationship(
           back_populates="transcription"
       )

       __table_args__ = (
           Index(
               "uq_transcriptions_content_item_id",
               "content_item_id",
               unique=True,
           ),
           Index("ix_transcriptions_status", "status"),
       )
   ```

2. `app/models/content_item.py`:
   - Добавить `DOWNLOADING = "downloading"` в `ContentStatus`
   - Добавить relationship:
     ```python
     transcription: Mapped["Transcription | None"] = relationship(
         back_populates="content_item", uselist=False
     )
     ```
   - Добавить import в TYPE_CHECKING:
     ```python
     if TYPE_CHECKING:
         from app.models.transcription import Transcription
     ```

3. `app/models/__init__.py` — реэкспорт `Transcription`, `TranscriptionStatus`

4. Миграция:
   ```bash
   alembic revision --autogenerate -m "add transcriptions table and downloading status"
   ```
   **Обязательно проверить миграцию вручную:**
   - `ALTER TYPE contentstatus ADD VALUE 'downloading'` — Alembic может не подхватить, добавить руками:
     ```python
     # В upgrade():
     op.execute("ALTER TYPE contentstatus ADD VALUE IF NOT EXISTS 'downloading'")
     ```
   - Unique index на `content_item_id` создан
   - Index на `status` создан

   ```bash
   alembic upgrade head
   ```

**Проверка:** `ruff`, `pyrefly`, `alembic upgrade head` без ошибок. `\d transcriptions` показывает все колонки и индексы.

**Коммит:** `feat(transcription): add Transcription model and downloading status`

---

## Chunk 3: YouTubeParser.download_audio()

> Можно делать параллельно с Chunk 4.

**Цель:** Метод скачивания аудио в WAV 16kHz mono.

**Изменяемые файлы:**
```
app/integrations/youtube.py
```

**Что делать:**

1. Добавить `AudioDownloadResult` dataclass:
   ```python
   @dataclass(frozen=True)
   class AudioDownloadResult:
       file_path: str
       file_size_bytes: int
       duration_seconds: int
   ```

2. Добавить `YouTubeDownloadError(Exception)` — рядом с `YouTubeParseError`

3. Добавить метод `download_audio(self, url: str, output_path: str) -> AudioDownloadResult`:
   - yt-dlp опции:
     ```python
     {
         "format": "bestaudio/best",
         "postprocessors": [{
             "key": "FFmpegExtractAudio",
             "preferredcodec": "wav",
         }],
         "postprocessor_args": {"FFmpegExtractAudio": ["-ar", "16000", "-ac", "1"]},
         "outtmpl": output_path,   # без расширения, yt-dlp добавит .wav
         "quiet": True,
         "no_warnings": True,
         "socket_timeout": 60,
         "noplaylist": True,
         "cachedir": False,
         "no_color": True,
     }
     ```
   - После скачивания: проверить файл существует и > 0 bytes
   - Получить duration из info_dict или через ffprobe
   - Обработка ошибок: yt-dlp exception → `YouTubeDownloadError`
   - Edge case: видео без аудиодорожки → `YouTubeDownloadError("No audio stream available")`

4. **Важно:** 16kHz mono WAV = нативный формат Whisper. Размер: ~1.9 MB/мин.

**Проверка:** `ruff`, `pyrefly`. Ручной тест на коротком видео (опционально).

**Коммит:** `feat(youtube): add download_audio method for WAV extraction`

---

## Chunk 4: WhisperTranscriber

> Можно делать параллельно с Chunk 3.

**Цель:** Обёртка над openai-whisper для локальной транскрибации.

**Новые файлы:**
```
app/integrations/whisper.py
```

**Что делать:**

1. Добавить `TranscriptionResult` dataclass:
   ```python
   @dataclass(frozen=True)
   class TranscriptionResult:
       text: str
       language: str
       duration_seconds: int
   ```

2. Добавить `WhisperError(Exception)`

3. Создать `WhisperTranscriber`:
   ```python
   class WhisperTranscriber:
       def __init__(self, model_size: str = "small"):
           self.model_size = model_size
           self._model = None

       def _get_model(self):
           """Lazy load модели. Кэшируется в self._model."""
           if self._model is None:
               import whisper
               self._model = whisper.load_model(self.model_size)
           return self._model

       def transcribe(self, audio_path: str) -> TranscriptionResult:
           """Транскрибировать аудио файл."""
           if not os.path.exists(audio_path):
               raise WhisperError(f"Audio file not found: {audio_path}")
           if os.path.getsize(audio_path) == 0:
               raise WhisperError("Empty audio file")

           model = self._get_model()
           result = model.transcribe(audio_path, fp16=False)
           # fp16=False для CPU. На GPU можно True.

           text = result.get("text", "").strip()
           language = result.get("language", "unknown")
           # duration: вычислить из segments или из файла
   ```

4. **Ключевые детали:**
   - `import whisper` только внутри `_get_model()` — lazy import (torch тяжёлый)
   - Модель загружается один раз per process (Celery prefork worker → один раз per child)
   - `fp16=False` обязательно для CPU (иначе ошибка)
   - Whisper сам обрабатывает длинные файлы 30-секундными окнами → чанкинг не нужен

**Проверка:** `ruff`, `pyrefly`.

**Коммит:** `feat(whisper): add local WhisperTranscriber integration`

---

## Chunk 5: Refactor parse_content → parse_metadata

**Цель:** Существующий таск переименовывается и становится первым шагом пайплайна.

**Файлы:**

Удалить/переименовать:
```
app/worker/tasks/parse_content.py → app/worker/tasks/parse_metadata.py
```

**Изменяемые:**
```
app/worker/tasks/__init__.py
app/services/content_service.py
```

**Что делать:**

1. Переименовать файл: `parse_content.py` → `parse_metadata.py`

2. Переименовать таск и функцию:
   - `parse_content_task` → `parse_metadata_task`
   - `name="parse_content"` → `name="parse_metadata"`

3. Изменить финальный статус (основное изменение):
   ```python
   # БЫЛО:
   item.status = ContentStatus.COMPLETED

   # СТАЛО:
   item.status = ContentStatus.DOWNLOADING
   db.commit()

   # Dispatch next step
   from app.worker.tasks.download_audio import download_audio_task
   download_audio_task.delay(content_item_id)
   ```

4. Добавить проверку длительности перед dispatch:
   ```python
   if metadata.duration_seconds and metadata.duration_seconds > settings.max_video_duration_minutes * 60:
       item.status = ContentStatus.COMPLETED  # пропустить audio/transcription
       db.commit()
       logger.warning(
           "Video exceeds duration limit, skipping audio download",
           content_item_id=content_item_id,
           duration=metadata.duration_seconds,
           limit=settings.max_video_duration_minutes * 60,
       )
       return {"status": "completed", "skipped": "duration_limit"}
   ```

5. `app/worker/tasks/__init__.py` — обновить импорт:
   ```python
   from app.worker.tasks.parse_metadata import parse_metadata_task  # was parse_content
   ```

6. `app/services/content_service.py` — обновить два места:
   - `add_content()` строка 57: `from app.worker.tasks.parse_metadata import parse_metadata_task`
   - `retry_content()` строка 123: то же самое

**Проверка:** `ruff`, `pyrefly`. Убедиться что старый `parse_content.py` удалён.

**Коммит:** `refactor(worker): rename parse_content to parse_metadata, add pipeline dispatch`

---

## Chunk 6: download_audio task

**Цель:** Второй шаг пайплайна — скачивание аудио.

**Новые файлы:**
```
app/worker/tasks/download_audio.py
```

**Изменяемые:**
```
app/worker/tasks/__init__.py
```

**Что делать:**

1. Создать `download_audio_task`:
   ```python
   @celery_app.task(
       bind=True,
       name="download_audio",
       max_retries=2,
       default_retry_delay=120,
       acks_late=True,
       time_limit=600,
       soft_time_limit=570,
   )
   def download_audio_task(self, content_item_id: int) -> dict:
   ```

2. Флоу (внутри try/finally с db.close()):
   ```
   a. Load ContentItem (filter deleted_at IS NULL)
   b. Skip if not found or deleted
   c. Generate output_path:
      output_path = f"{settings.audio_storage_path}/{content_item_id}_{uuid4().hex[:8]}"
      os.makedirs(settings.audio_storage_path, exist_ok=True)
   d. parser = YouTubeParser()
      result = parser.download_audio(str(item.url), output_path)
   e. item.audio_path = result.file_path
   f. Create Transcription record:
      transcription = Transcription(
          content_item_id=item.id,
          status=TranscriptionStatus.PENDING,
      )
      db.add(transcription)
   g. item.status = ContentStatus.COMPLETED
      item.celery_task_id = None
      db.commit()
   h. # Dispatch next step AFTER commit
      from app.worker.tasks.transcribe_content import transcribe_content_task
      task = transcribe_content_task.delay(transcription.id)
   i. transcription.celery_task_id = task.id
      db.commit()
   ```

3. Error handling — аналогично parse_metadata:
   - `SoftTimeLimitExceeded` → mark FAILED
   - `YouTubeDownloadError` / `Exception`:
     - Increment retry_count
     - If retries < max → retry с exponential backoff
     - If retries >= max → FAILED
   - При FAILED: `item.status = ContentStatus.FAILED`

4. Cleanup on failure: если audio файл частично скачан, удалить его:
   ```python
   except ...:
       if output_path and os.path.exists(output_path + ".wav"):
           os.remove(output_path + ".wav")
   ```

5. `__init__.py` — добавить импорт

**Проверка:** `ruff`, `pyrefly`

**Коммит:** `feat(worker): add download_audio task with pipeline dispatch`

---

## Chunk 7: transcribe_content task

**Цель:** Третий шаг пайплайна — транскрибация.

**Новые файлы:**
```
app/worker/tasks/transcribe_content.py
```

**Изменяемые:**
```
app/worker/tasks/__init__.py
```

**Что делать:**

1. Создать `transcribe_content_task`:
   ```python
   @celery_app.task(
       bind=True,
       name="transcribe_content",
       max_retries=1,
       default_retry_delay=300,
       acks_late=True,
       time_limit=7200,       # 2 часа
       soft_time_limit=7100,
   )
   def transcribe_content_task(self, transcription_id: int) -> dict:
   ```

2. Флоу:
   ```
   a. Load Transcription by id
   b. Skip if not found
   c. Load ContentItem by transcription.content_item_id
   d. Skip if content deleted (deleted_at IS NOT NULL)
   e. transcription.status = TranscriptionStatus.PROCESSING
      db.commit()
   f. Verify audio file exists:
      if not item.audio_path or not os.path.exists(item.audio_path):
          → mark FAILED("Audio file not found"), return
   g. transcriber = WhisperTranscriber(settings.whisper_model_size)
      result = transcriber.transcribe(item.audio_path)
   h. transcription.text = result.text
      transcription.language = result.language
      transcription.duration_seconds = result.duration_seconds
      transcription.whisper_model = settings.whisper_model_size
      transcription.status = TranscriptionStatus.COMPLETED
      transcription.error_message = None
      db.commit()
   i. # Cleanup audio file
      try:
          os.remove(item.audio_path)
          item.audio_path = None
          db.commit()
      except OSError:
          logger.warning("Failed to delete audio", path=item.audio_path)
   ```

3. Error handling:
   - `SoftTimeLimitExceeded` → FAILED("Transcription timed out")
   - `WhisperError` → FAILED (no retry — likely bad audio)
   - `Exception` → retry или FAILED
   - **Различие:** `WhisperError` (bad file, empty audio) — не retryable. Network/transient errors — retryable.

4. `__init__.py` — добавить импорт

**Проверка:** `ruff`, `pyrefly`

**Коммит:** `feat(worker): add transcribe_content task with local Whisper`

---

## Chunk 8: Repository + Service

**Цель:** Async слой для транскрипций.

**Новые файлы:**
```
app/repositories/transcription_repository.py
app/services/transcription_service.py
```

**Что делать:**

1. `app/repositories/transcription_repository.py`:
   ```python
   class TranscriptionRepository(BaseRepository[Transcription]):

       async def get_by_content_id(
           self, content_item_id: int
       ) -> Transcription | None:
           """Get transcription by content_item_id."""
           query = select(Transcription).where(
               Transcription.content_item_id == content_item_id
           )
           result = await self.db.execute(query)
           return result.scalar_one_or_none()

       async def update_status(
           self,
           transcription: Transcription,
           status: TranscriptionStatus,
           error_message: str | None = None,
           **kwargs,
       ) -> Transcription:
           """Update transcription status and optional fields."""
           transcription.status = status
           transcription.error_message = error_message
           for key, value in kwargs.items():
               setattr(transcription, key, value)
           await self.db.flush()
           await self.db.refresh(transcription)
           return transcription
   ```

2. `app/services/transcription_service.py`:
   ```python
   class TranscriptionService:
       def __init__(self, db: AsyncSession) -> None:
           self.db = db
           self.transcription_repo = TranscriptionRepository(db)
           self.content_repo = ContentRepository(db)

       async def get_transcription(
           self, workspace_id: int, content_id: int
       ) -> Transcription:
           """Get transcription with workspace ownership check."""
           # 1. Verify content exists in workspace
           content = await self.content_repo.get_by_workspace_and_id(
               workspace_id, content_id
           )
           if not content:
               raise NotFoundException("Content not found")
           # 2. Get transcription
           transcription = await self.transcription_repo.get_by_content_id(
               content_id
           )
           if not transcription:
               raise NotFoundException("Transcription not found")
           return transcription

       async def retry_transcription(
           self, workspace_id: int, content_id: int
       ) -> Transcription:
           """Retry FAILED transcription. Updates existing record, no duplicates."""
           content = await self.content_repo.get_by_workspace_and_id(
               workspace_id, content_id
           )
           if not content:
               raise NotFoundException("Content not found")

           transcription = await self.transcription_repo.get_by_content_id(
               content_id
           )
           if not transcription:
               raise NotFoundException("Transcription not found")

           if transcription.status != TranscriptionStatus.FAILED:
               raise AppException(
                   "Retry is only available for FAILED transcriptions",
                   status_code=400,
               )

           # Verify audio file still exists (needed for re-transcription)
           if not content.audio_path:
               raise AppException(
                   "Audio file not available. Retry content download first.",
                   status_code=400,
               )

           # UPDATE existing record
           transcription.status = TranscriptionStatus.PENDING
           transcription.error_message = None
           transcription.retry_count = 0
           await self.db.flush()
           await self.db.commit()

           from app.worker.tasks.transcribe_content import (
               transcribe_content_task,
           )
           task = transcribe_content_task.delay(transcription.id)

           transcription.celery_task_id = task.id
           await self.db.commit()

           return transcription
   ```

**Проверка:** `ruff`, `pyrefly`

**Коммит:** `feat(transcription): add repository and service`

---

## Chunk 9: Schemas + API Endpoints

**Цель:** Pydantic схемы, HTTP endpoints, обновление ContentItemResponse.

**Новые файлы:**
```
app/schemas/transcription.py
app/api/transcription.py
```

**Изменяемые:**
```
app/schemas/content.py
app/api/router.py
```

**Что делать:**

1. `app/schemas/transcription.py`:
   ```python
   class TranscriptionResponse(BaseModel):
       model_config = ConfigDict(from_attributes=True)

       id: int
       content_item_id: int
       status: str
       text: str | None
       language: str | None
       duration_seconds: int | None
       whisper_model: str | None
       error_message: str | None
       created_at: datetime
       updated_at: datetime

   class TranscriptionShortResponse(BaseModel):
       model_config = ConfigDict(from_attributes=True)

       status: str
       language: str | None
       duration_seconds: int | None
   ```

2. `app/schemas/content.py` — добавить в `ContentItemResponse`:
   ```python
   transcription: TranscriptionShortResponse | None = None
   ```
   > **⚠️ Breaking change**: Hey-api перегенерит типы. Поле nullable → backward-compatible.

3. `app/api/transcription.py`:
   ```python
   router = APIRouter(prefix="/workspaces/{workspace_id}/content/{content_id}", tags=["Transcription"])

   @router.get(
       "/transcription",
       response_model=TranscriptionResponse,
       status_code=200,
       summary="Get transcription for content",
       responses={404: {"description": "Content or transcription not found"}},
   )
   async def get_transcription(
       workspace_id: int,
       content_id: int,
       current_user: ... = Depends(get_current_user),
       workspace_data: ... = Depends(get_workspace_from_path),
       db: AsyncSession = Depends(get_db),
   ) -> TranscriptionResponse:
       service = TranscriptionService(db)
       return await service.get_transcription(workspace_id, content_id)

   @router.post(
       "/transcription/retry",
       response_model=TranscriptionResponse,
       status_code=200,
       summary="Retry failed transcription",
       responses={
           400: {"description": "Transcription is not in FAILED status"},
           404: {"description": "Content or transcription not found"},
       },
   )
   async def retry_transcription(
       workspace_id: int,
       content_id: int,
       current_user: ... = Depends(get_current_user),
       workspace_data: ... = Depends(get_workspace_from_path),
       db: AsyncSession = Depends(get_db),
   ) -> TranscriptionResponse:
       _, member = workspace_data
       require_role(member, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR])
       service = TranscriptionService(db)
       return await service.retry_transcription(workspace_id, content_id)
   ```

4. `app/api/router.py` — подключить transcription router

5. **Eager loading transcription в content queries:**
   Обновить `ContentRepository.get_by_workspace()` и `get_by_workspace_and_id()`:
   - Добавить `options(joinedload(ContentItem.transcription))` к запросам
   - Чтобы ContentItemResponse мог включать `transcription` поле без N+1

**Проверка:** `ruff`, `pyrefly`. Swagger UI — проверить новые endpoints.

**Коммит:** `feat(transcription): add schemas and API endpoints`

---

## Chunk 10: ContentService — delete/retry updates

**Цель:** delete и retry корректно работают с пайплайном из 3 тасков.

**Изменяемые:**
```
app/services/content_service.py
```

**Что делать:**

1. Добавить `TranscriptionRepository` в `__init__`:
   ```python
   self.transcription_repo = TranscriptionRepository(db)
   ```

2. `delete_content()` — обновить (бывший C2):
   ```python
   async def delete_content(self, workspace_id: int, content_id: int) -> None:
       item = await self.get_content(workspace_id, content_id)

       # 1. Revoke content pipeline tasks (parse/download)
       if item.status in (
           ContentStatus.PENDING,
           ContentStatus.PROCESSING,
           ContentStatus.DOWNLOADING,
       ) and item.celery_task_id:
           from app.worker.celery_app import celery_app
           celery_app.control.revoke(item.celery_task_id)

       # 2. Revoke transcription task if running
       transcription = await self.transcription_repo.get_by_content_id(item.id)
       if transcription and transcription.status in (
           TranscriptionStatus.PENDING,
           TranscriptionStatus.PROCESSING,
       ) and transcription.celery_task_id:
           from app.worker.celery_app import celery_app
           celery_app.control.revoke(transcription.celery_task_id)

       # 3. Cleanup audio file
       if item.audio_path:
           import os
           try:
               if os.path.exists(item.audio_path):
                   os.remove(item.audio_path)
           except OSError:
               logger.warning("Failed to delete audio", path=item.audio_path)

       # 4. Soft delete
       await self.content_repo.soft_delete(item.id)
       await self.db.commit()
   ```

3. `retry_content()` — обновить (бывший C3):
   ```python
   async def retry_content(self, workspace_id: int, content_id: int) -> ContentItem:
       item = await self.get_content(workspace_id, content_id)

       if item.status != ContentStatus.FAILED:
           raise AppException(
               "Retry is only available for content with FAILED status",
               status_code=400,
           )

       # Determine which step failed and restart from there
       if item.title is None:
           # Step 1 failed: metadata not parsed → restart from parse
           item.status = ContentStatus.PENDING
           from app.worker.tasks.parse_metadata import parse_metadata_task
           task_func = parse_metadata_task
       else:
           # Step 2 failed: audio not downloaded → restart from download
           item.status = ContentStatus.DOWNLOADING
           from app.worker.tasks.download_audio import download_audio_task
           task_func = download_audio_task

       item.error_message = None
       item.retry_count = 0
       await self.db.flush()
       await self.db.commit()

       task = task_func.delay(item.id)
       item.celery_task_id = task.id
       await self.db.commit()

       return item
   ```

   > **Важно:** retry_content НЕ создаёт Transcription. Она создаётся в download_audio_task.
   > Retry транскрибации — через отдельный endpoint (Chunk 9).

**Проверка:** `ruff`, `pyrefly`

**Коммит:** `feat(content): update delete and retry for pipeline architecture`

---

## Chunk 11: Recovery task

**Цель:** Celery-beat задача для "застрявших" items (бывший C4).

**Новые файлы:**
```
app/worker/tasks/recovery.py
```

**Изменяемые:**
```
app/worker/celery_app.py
```

**Что делать:**

1. `app/worker/tasks/recovery.py`:
   ```python
   from datetime import datetime, timedelta, timezone

   STUCK_THRESHOLD_MINUTES = 10

   @celery_app.task(name="recover_stuck_items")
   def recover_stuck_items() -> dict:
       """Find and re-dispatch stuck pipeline items."""
       db = SyncSessionLocal()
       threshold = datetime.now(timezone.utc) - timedelta(minutes=STUCK_THRESHOLD_MINUTES)
       recovered = 0
       try:
           # 1. ContentItems stuck in DOWNLOADING (metadata done, download never started/crashed)
           stuck_downloads = (
               db.query(ContentItem)
               .filter(
                   ContentItem.status == ContentStatus.DOWNLOADING,
                   ContentItem.updated_at < threshold,
                   ContentItem.deleted_at.is_(None),
               )
               .all()
           )
           for item in stuck_downloads:
               download_audio_task.delay(item.id)
               recovered += 1
               logger.info("Recovered stuck download", content_item_id=item.id)

           # 2. Transcriptions stuck in PENDING (download done, transcription never started)
           stuck_transcriptions = (
               db.query(Transcription)
               .join(ContentItem)
               .filter(
                   Transcription.status == TranscriptionStatus.PENDING,
                   Transcription.updated_at < threshold,
                   ContentItem.deleted_at.is_(None),
               )
               .all()
           )
           for t in stuck_transcriptions:
               transcribe_content_task.delay(t.id)
               recovered += 1
               logger.info("Recovered stuck transcription", transcription_id=t.id)

       finally:
           db.close()

       return {"recovered": recovered}
   ```

2. `app/worker/celery_app.py` — добавить beat_schedule:
   ```python
   celery_app.conf.beat_schedule = {
       "recover-stuck-items": {
           "task": "recover_stuck_items",
           "schedule": 600.0,  # каждые 10 мин
       },
   }
   ```

3. `app/worker/tasks/__init__.py` — добавить импорт

**Проверка:** `ruff`, `pyrefly`

**Коммит:** `feat(worker): add recovery task for stuck pipeline items`

---

## Chunk 12: Tests

**Цель:** Покрытие нового функционала тестами.

**Новые файлы:**
```
tests/test_whisper_integration.py
tests/test_download_audio_integration.py
tests/test_transcription_api.py
tests/test_transcription_service.py
tests/test_pipeline_tasks.py
```

**Изменяемые:**
```
tests/conftest.py         (добавить fixtures)
tests/test_content.py     (обновить для новых статусов)
```

**Тест-кейсы по группам:**

### Integrations (mock yt-dlp / whisper)

- `test_download_audio_success` — mock yt-dlp → AudioDownloadResult
- `test_download_audio_no_audio_stream` → YouTubeDownloadError
- `test_whisper_transcribe_success` — mock whisper.load_model → TranscriptionResult
- `test_whisper_file_not_found` → WhisperError
- `test_whisper_empty_file` → WhisperError
- `test_whisper_lazy_model_loading` — load_model вызывается один раз

### Pipeline tasks (mock integrations)

- `test_parse_metadata_dispatches_download` — status=DOWNLOADING, download_audio.delay called
- `test_parse_metadata_skips_long_video` — status=COMPLETED, no download dispatched
- `test_download_audio_creates_transcription` — Transcription created, dispatch transcribe
- `test_download_audio_skips_deleted_content` — return early
- `test_transcribe_success` — text saved, audio deleted, status=COMPLETED
- `test_transcribe_deleted_content` — skip
- `test_transcribe_missing_audio` — status=FAILED
- `test_transcribe_timeout` → FAILED("Transcription timed out")

### TranscriptionService (unit)

- `test_get_transcription_success`
- `test_get_transcription_not_found` → NotFoundException
- `test_get_transcription_wrong_workspace` → NotFoundException
- `test_retry_transcription_success` — updates existing record
- `test_retry_transcription_not_failed` → AppException
- `test_retry_transcription_no_audio` → AppException

### ContentService updates (unit)

- `test_delete_revokes_both_tasks` — content task + transcription task revoked
- `test_delete_cleans_audio_file`
- `test_retry_no_title_dispatches_parse` — status=PENDING, parse_metadata.delay
- `test_retry_has_title_dispatches_download` — status=DOWNLOADING, download_audio.delay

### API endpoints (integration)

- `test_get_transcription_endpoint` — 200, full response
- `test_get_transcription_404`
- `test_retry_transcription_endpoint` — 200
- `test_retry_transcription_not_failed` — 400

### Content list with transcription (integration)

- `test_list_content_includes_transcription_status` — TranscriptionShortResponse in response

**Проверка:** `pytest -v --cov=app` — все зелёные, coverage не упал.

**Коммит:** `test(transcription): add unit and integration tests for pipeline`

---

## Chunk 13: Deploy

**Цель:** Деплой на production (155.212.190.58).

**Checklist:**

```
 1. [ ] SSH на сервер
 2. [ ] apt install ffmpeg (если нет)
 3. [ ] pip install -e . (в venv — подтянет openai-whisper + torch, ~2GB)
 4. [ ] Предзагрузка модели:
        python -c "import whisper; whisper.load_model('small')"
        (скачает ~244MB в ~/.cache/whisper/)
 5. [ ] Создать директорию:
        mkdir -p /var/denco/audio
        chown denco:denco /var/denco/audio
 6. [ ] Обновить .env:
        WHISPER_MODEL_SIZE=small
        AUDIO_STORAGE_PATH=/var/denco/audio
        MAX_VIDEO_DURATION_MINUTES=180
 7. [ ] alembic upgrade head
 8. [ ] Обновить systemd для Celery — два воркера:
        # denco-celery.service (обновить ExecStart):
        ExecStart=celery -A app.worker.celery_app worker -Q default -c 4

        # denco-celery-transcription.service (НОВЫЙ):
        ExecStart=celery -A app.worker.celery_app worker -Q transcription -c 1 --max-memory-per-child=4000000

        # denco-celery-beat.service (НОВЫЙ):
        ExecStart=celery -A app.worker.celery_app beat
 9. [ ] systemctl daemon-reload
10. [ ] systemctl restart denco-backend denco-celery
11. [ ] systemctl enable --now denco-celery-transcription denco-celery-beat
12. [ ] Smoke test: добавить короткое видео (< 5 мин), проверить полный пайплайн
13. [ ] Мониторинг: htop — RAM при транскрибации (ожидаемо ~2GB для small model)
14. [ ] Проверить: файл удаляется после транскрибации
```

---

## Сводка

| Chunk | Описание | Зависит от | Новые файлы | Изменяемые файлы |
|-------|----------|------------|-------------|-----------------|
| 1 | Config + deps | — | — | config, pyproject, celery_app, db |
| 2 | Model + migration | 1 | transcription.py, migration | content_item, models/__init__ |
| 3 | download_audio() | 2 | — | youtube.py |
| 4 | WhisperTranscriber | 2 | whisper.py | — |
| 5 | Refactor parse_metadata | 2 | parse_metadata.py | tasks/__init__, content_service |
| 6 | download_audio task | 3, 5 | download_audio.py | tasks/__init__ |
| 7 | transcribe_content task | 4, 6 | transcribe_content.py | tasks/__init__ |
| 8 | Repository + Service | 2 | transcription_repo, transcription_service | — |
| 9 | Schemas + API | 8 | transcription schema, transcription api | content schema, router, content_repo |
| 10 | Content delete/retry | 5, 6, 7, 8 | — | content_service |
| 11 | Recovery task | 6, 7 | recovery.py | celery_app |
| 12 | Tests | all above | 5 test files | conftest, test_content |
| 13 | Deploy | 12 | — | systemd, .env |

**Итого: 13 chunks, 12 коммитов (deploy без коммита), ~12 новых файлов, ~12 изменяемых.**
