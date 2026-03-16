# Sprint 3 — Strategy: Транскрибация видео через локальный Whisper

## Контекст

Сейчас `ContentItem` проходит один этап: **парсинг метаданных** (yt-dlp, `skip_download=True`).
Sprint 3 добавляет пайплайн из трёх независимых шагов:

```
parse_metadata → download_audio → transcribe_content
```

Каждый шаг — отдельный Celery task с независимым retry.

### Что уже есть

- `ContentItem` модель: `audio_path` (VARCHAR 1024, пустое), `status` (PENDING/PROCESSING/COMPLETED/FAILED)
- Celery task `parse_content_task` — fetch_metadata через yt-dlp (`skip_download=True`)
- `YouTubeParser` с `fetch_metadata()` и `extract_video_id()`
- Sync DB сессия для Celery (`app/worker/db.py`, pool_size=5)
- Redis broker (index 1) + result backend (index 2)
- `content_service`: `add_content()` → dispatch task, `delete_content()` → revoke task, `retry_content()` → re-dispatch

---

## Принятые решения

| # | Решение | Выбор |
|---|---------|-------|
| 1 | Модель данных | Отдельная таблица `transcriptions` |
| 2 | Запуск транскрибации | Автоматически после скачивания аудио |
| 3 | Провайдер | Локальный Whisper (`openai-whisper`), НЕ OpenAI API |
| 4 | Архитектура тасков | 3 независимых Celery task (пайплайн) |
| 5 | Хранение аудио | Удалять после успешной транскрибации |
| 6 | Определение языка | Auto-detect (Whisper определяет сам) |

---

## Архитектура пайплайна

### Три независимых таска

```
add_content()
  └→ parse_metadata_task.delay(content_item_id)

parse_metadata_task:
  1. Fetch metadata (yt-dlp, skip_download=True)
  2. Save title/description/duration/video_id
  3. content.status = PARSED  (НЕ COMPLETED — пайплайн ещё идёт)
  4. Commit → dispatch download_audio_task.delay(content_item_id)

download_audio_task:
  1. content.status = DOWNLOADING
  2. Download audio (yt-dlp + ffmpeg → 16kHz WAV mono)
  3. Save audio_path
  4. Create Transcription(status=PENDING)
  5. content.status = COMPLETED
  6. Commit → dispatch transcribe_content_task.delay(transcription_id)

transcribe_content_task:
  1. transcription.status = PROCESSING
  2. Load Whisper model, transcribe audio
  3. Save text + language
  4. transcription.status = COMPLETED
  5. Delete audio file
```

### Почему 3 таска, а не 1 (бывший C1)

| Проблема монолита | Решение с пайплайном |
|---|---|
| Metadata OK → download упал → всё FAILED, metadata потеряна | Metadata уже сохранена, retry только download |
| time_limit 300s → 600s → 900s (растёт бесконтрольно) | Каждый таск со своим адекватным лимитом |
| Retry перезапускает с нуля | Retry только упавший шаг |
| Невозможно узнать, на каком шаге зависло | Статус показывает конкретный шаг |

### Статусы ContentItem — расширение enum

```python
class ContentStatus(enum.StrEnum):
    PENDING = "pending"           # создан, ждёт parse_metadata
    PROCESSING = "processing"     # parse_metadata работает
    DOWNLOADING = "downloading"   # download_audio работает  ← NEW
    COMPLETED = "completed"       # metadata + audio готовы
    FAILED = "failed"             # любой шаг упал
```

Добавляется **одно** новое значение: `DOWNLOADING`. Миграция: `ALTER TYPE contentstatus ADD VALUE 'downloading'`.

> **⚠️ Breaking change для фронтенда**: новый статус `downloading` в enum. Hey-api перегенерит типы. Фронтенду нужно добавить обработку нового статуса.

### Статусы Transcription — отдельный lifecycle

```python
class TranscriptionStatus(enum.StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
```

### Комбинированный статус для UI

| content.status | transcription | Что видит пользователь |
|---|---|---|
| `pending` | — | Ожидание... |
| `processing` | — | Парсинг метаданных... |
| `downloading` | — | Скачивание аудио... |
| `failed` | — | Ошибка (retry перезапустит нужный шаг) |
| `completed` | `null` | Метаданные готовы (нет транскрипции) |
| `completed` | `pending/processing` | Транскрибация... |
| `completed` | `completed` | Готово ✓ |
| `completed` | `failed` | Транскрибация не удалась (retry) |

---

## Модель данных

### Таблица `transcriptions`

```
transcriptions
├── id (PK, autoincrement)
├── content_item_id (FK → content_items.id, UNIQUE)
├── status (TranscriptionStatus, default=PENDING)
├── text (TEXT) — полный текст транскрипции
├── language (VARCHAR 10) — определённый язык ("ru", "en", "uk")
├── duration_seconds (INT) — длительность обработанного аудио
├── whisper_model (VARCHAR 20) — какой моделью транскрибировали
├── error_message (TEXT)
├── retry_count (INT, default 0)
├── celery_task_id (VARCHAR 255)
├── created_at, updated_at (TimestampMixin)
```

Индексы:
- `uq_transcriptions_content_item_id` (unique) — один контент = одна транскрипция
- `ix_transcriptions_status` — фильтрация по статусу

SQLAlchemy relationship:
```python
# В ContentItem:
transcription: Mapped[Transcription | None] = relationship(back_populates="content_item", uselist=False)

# В Transcription:
content_item: Mapped[ContentItem] = relationship(back_populates="transcription")
```

> **Важно:** `audio_path` уже существует в `ContentItem` (строка 45 модели). Миграция для этого поля НЕ нужна.

---

## Локальный Whisper

### Почему локальный, а не OpenAI API

| | OpenAI API | Локальный Whisper |
|---|---|---|
| Стоимость | ~$0.006/мин ($540/мес при 100 видео/день) | $0 (только compute) |
| Зависимость | Внешний сервис, rate limits, API key | Полный контроль |
| Скорость | Быстро (~realtime) | Зависит от модели и CPU/GPU |
| Приватность | Аудио отправляется в OpenAI | Всё локально |
| Размер deps | ~5 MB (openai SDK) | ~3 GB (torch + model) |

### Модели и характеристики

| Модель | Размер | RAM (CPU) | Скорость CPU | Качество |
|--------|--------|-----------|-------------|----------|
| `tiny` | 39 MB | ~1 GB | ~10x realtime | Низкое |
| `base` | 74 MB | ~1 GB | ~5x realtime | Среднее |
| `small` | 244 MB | ~2 GB | ~3x realtime | Хорошее |
| `medium` | 769 MB | ~5 GB | ~1x realtime | Высокое |
| `large-v3` | 1.5 GB | ~10 GB | ~0.3x realtime | Максимальное |

> "3x realtime" = 1 час видео обрабатывается за ~20 мин на CPU.

**Рекомендация:** начать с `small` (хороший баланс качество/скорость). Настраиваемо через config.

### Оценка времени обработки (модель `small`, CPU)

| Длительность видео | Время транскрибации |
|---|---|
| 10 мин | ~3 мин |
| 30 мин | ~10 мин |
| 1 час | ~20 мин |
| 3 часа (лимит) | ~60 мин |

### Зависимости

```toml
# pyproject.toml
openai-whisper >= 20231117    # Whisper (тянет torch, numpy, etc.)
```

Системные:
```bash
apt install ffmpeg    # обязателен для yt-dlp и whisper
```

> **Внимание:** `torch` ≈ 2 GB. Docker image вырастет значительно. При деплое: загрузка модели при первом запуске (~244 MB для `small`). Модель кэшируется в `~/.cache/whisper/`.

### Интеграция — `app/integrations/whisper.py`

```python
@dataclass(frozen=True)
class TranscriptionResult:
    text: str
    language: str
    duration_seconds: int

class WhisperTranscriber:
    """Обёртка над openai-whisper для локальной транскрибации."""

    def __init__(self, model_size: str = "small"):
        self.model_size = model_size
        self._model = None  # lazy load

    def _get_model(self):
        """Загрузить модель (кэшируется после первого вызова)."""
        if not self._model:
            import whisper
            self._model = whisper.load_model(self.model_size)
        return self._model

    def transcribe(self, audio_path: str) -> TranscriptionResult:
        """Транскрибировать аудио файл."""
        model = self._get_model()
        result = model.transcribe(audio_path)
        # result: {"text": "...", "language": "ru", "segments": [...]}
```

- Модель загружается **один раз** per worker process (lazy singleton)
- Whisper внутренне обрабатывает аудио 30-секундными окнами → длинные файлы OK
- Нет лимита 25 MB (локальная обработка)
- Chunking НЕ нужен для Whisper (только для памяти при очень длинных файлах)

---

## Исправления CRITICAL проблем

### C1: parse_content монолит → РЕШЕНО

Три отдельных таска. См. "Архитектура пайплайна" выше.

### C2: delete_content не отзывает transcribe task → РЕШЕНО

Обновить `content_service.delete_content()`:

```python
async def delete_content(self, workspace_id: int, content_id: int) -> None:
    item = await self.get_content(workspace_id, content_id)

    # Revoke content pipeline tasks
    if item.status in (ContentStatus.PENDING, ContentStatus.PROCESSING,
                       ContentStatus.DOWNLOADING) and item.celery_task_id:
        celery_app.control.revoke(item.celery_task_id)

    # Revoke transcription task if running
    transcription = await self.transcription_repo.get_by_content_id(item.id)
    if transcription and transcription.status in (
        TranscriptionStatus.PENDING, TranscriptionStatus.PROCESSING
    ) and transcription.celery_task_id:
        celery_app.control.revoke(transcription.celery_task_id)

    # Cleanup audio file
    if item.audio_path and os.path.exists(item.audio_path):
        os.remove(item.audio_path)

    await self.content_repo.soft_delete(item.id)
    await self.db.commit()
```

### C3: retry_content дублирует Transcription → РЕШЕНО

`retry_content()` должен определить, **какой шаг** упал, и перезапустить именно его:

```python
async def retry_content(self, workspace_id: int, content_id: int) -> ContentItem:
    item = await self.get_content(workspace_id, content_id)

    # Case 1: content parsing/downloading failed → retry from failed step
    if item.status == ContentStatus.FAILED:
        # Determine which task to re-dispatch based on what data exists
        if item.title is None:
            # Metadata not parsed yet → restart from parse_metadata
            item.status = ContentStatus.PENDING
            task = parse_metadata_task.delay(item.id)
        else:
            # Metadata exists, audio failed → restart from download_audio
            item.status = ContentStatus.DOWNLOADING
            task = download_audio_task.delay(item.id)
        item.celery_task_id = task.id
        item.error_message = None
        ...

    # Case 2: content OK, transcription failed → retry transcription only
    # (через отдельный endpoint retry_transcription)
```

Отдельный endpoint `retry_transcription`:
```python
async def retry_transcription(self, workspace_id: int, content_id: int) -> Transcription:
    item = await self.get_content(workspace_id, content_id)
    transcription = await self.transcription_repo.get_by_content_id(item.id)

    if not transcription or transcription.status != TranscriptionStatus.FAILED:
        raise AppException("No failed transcription to retry", status_code=400)

    # UPDATE existing record, НЕ создавать новый (no duplicate)
    transcription.status = TranscriptionStatus.PENDING
    transcription.error_message = None
    transcription.retry_count = 0
    # ... dispatch task, update celery_task_id
```

**Ключевое:** retry обновляет существующую запись Transcription, НЕ создаёт новую. Unique constraint не нарушается.

### C4: Атомарность Celery dispatch + DB commit → РЕШЕНО

Паттерн "commit-then-dispatch" для каждого таска:

```python
# Внутри каждого таска:
def task(self, content_item_id):
    db = SyncSessionLocal()
    try:
        # ... do work ...
        item.status = ContentStatus.COMPLETED  # или другой
        db.commit()  # ← шаг 1: данные сохранены

        # dispatch следующий таск ПОСЛЕ коммита
        next_task.delay(item.id)  # ← шаг 2: если упадёт — данные уже в БД
    finally:
        db.close()
```

**Worst case:** commit прошёл, dispatch упал (Redis down):
- Данные сохранены корректно
- Следующий таск не запустился → item "застрял"
- **Восстановление:** periodic Celery-beat задача `recover_stuck_items`:
  - Найти ContentItem со статусом COMPLETED без Transcription (старше 5 мин) → dispatch transcribe
  - Найти ContentItem с `title IS NOT NULL` и статусом PARSED (старше 5 мин) → dispatch download
  - Запускать раз в 10 минут

### C5: /tmp vs /var — несогласованность путей → РЕШЕНО

Единый путь: `/var/denco/audio/`. Конфигурируемо через `.env`:

```python
# app/config.py
audio_storage_path: str = "/var/denco/audio"
```

Структура:
```
/var/denco/audio/
└── {content_item_id}_{uuid4_short}.wav    # 16kHz mono WAV
```

- НЕ `/tmp` (удаляется при reboot)
- UUID в имени файла (защита от предсказуемых путей — бывший M3)
- `{content_item_id}` в имени для отладки

---

## Конфигурация

### Новые поля в `app/config.py`

```python
# Whisper
whisper_model_size: str = "small"                # tiny/base/small/medium/large
audio_storage_path: str = "/var/denco/audio"     # НЕ /tmp
max_video_duration_minutes: int = 180            # лимит 3 часа

# Celery queues
celery_transcription_concurrency: int = 2        # макс параллельных транскрибаций
```

### `.env` дополнение

```
WHISPER_MODEL_SIZE=small
AUDIO_STORAGE_PATH=/var/denco/audio
MAX_VIDEO_DURATION_MINUTES=180
```

---

## Celery: очереди и concurrency

### Проблема (бывший H1)

Без ограничений: 50 видео → 50 параллельных транскрибаций → OOM (каждая занимает ~2 GB RAM).

### Решение: отдельная очередь `transcription`

```python
# celery_app.py
celery_app.conf.task_routes = {
    "parse_metadata": {"queue": "default"},
    "download_audio": {"queue": "default"},
    "transcribe_content": {"queue": "transcription"},
}
```

Запуск воркеров:
```bash
# Основной воркер (парсинг + скачивание)
celery -A app.worker.celery_app worker -Q default -c 4

# Воркер транскрибации (ограниченный concurrency)
celery -A app.worker.celery_app worker -Q transcription -c 1 --max-memory-per-child=4000000
```

`-c 1` для транскрибации: одна модель Whisper в памяти, одна транскрибация за раз. Предотвращает OOM.
`--max-memory-per-child`: перезапуск воркера при утечке памяти.

---

## Скачивание аудио

### YouTubeParser — новый метод

**Файл:** `app/integrations/youtube.py`

```python
@dataclass(frozen=True)
class AudioDownloadResult:
    file_path: str
    file_size_bytes: int
    duration_seconds: int

def download_audio(self, url: str, output_path: str) -> AudioDownloadResult:
    """Скачать и конвертировать в 16kHz mono WAV (оптимально для Whisper)."""
```

yt-dlp опции:
```python
{
    "format": "bestaudio/best",
    "postprocessors": [{
        "key": "FFmpegExtractAudio",
        "preferredcodec": "wav",
    }],
    "postprocessor_args": ["-ar", "16000", "-ac", "1"],  # 16kHz mono
    "outtmpl": output_path,
    "socket_timeout": 60,
    "noplaylist": True,
}
```

> **16kHz mono WAV** — нативный формат Whisper. Нет потерь от перекодирования. Размер: ~1.9 MB/мин → 1 час ≈ 115 MB.

---

## Celery tasks — детали

### parse_metadata_task (рефакторинг существующего)

**Файл:** `app/worker/tasks/parse_content.py` → переименовать в `parse_metadata.py`

```python
@celery_app.task(
    bind=True, name="parse_metadata",
    max_retries=3, default_retry_delay=60,
    time_limit=300, soft_time_limit=270,     # без изменений — только metadata
)
def parse_metadata_task(self, content_item_id: int) -> dict:
    # 1. Load ContentItem
    # 2. status = PROCESSING
    # 3. YouTubeParser().fetch_metadata(url)
    # 4. Save metadata fields
    # 5. Check duration <= max_video_duration_minutes
    # 6. status = PARSED  (НЕ COMPLETED)
    # 7. Commit
    # 8. download_audio_task.delay(content_item_id)
```

**Изменения от текущего `parse_content_task`:**
- Финальный статус: `PARSED` вместо `COMPLETED` (новое значение enum... или можно оставить промежуточное значение)
- После commit: dispatch `download_audio_task`
- Проверка duration: если > лимита → status = COMPLETED (без скачивания), лог warning

> **Стоп.** Добавление `PARSED` в enum — ещё одна миграция и breaking change. Альтернатива: parse_metadata ставит `DOWNLOADING` сразу перед dispatch download_audio. Тогда enum: PENDING → PROCESSING → DOWNLOADING → COMPLETED/FAILED. Без лишнего значения.

**Решение:** parse_metadata ставит status = `DOWNLOADING` (означает "metadata готова, жду скачивания"). Enum расширяется только на одно значение.

### download_audio_task (новый)

**Файл:** `app/worker/tasks/download_audio.py`

```python
@celery_app.task(
    bind=True, name="download_audio",
    max_retries=2, default_retry_delay=120,
    time_limit=600, soft_time_limit=570,     # 10 мин — достаточно для download
)
def download_audio_task(self, content_item_id: int) -> dict:
    # 1. Load ContentItem
    # 2. Check deleted_at (content may have been deleted while queued)
    # 3. YouTubeParser().download_audio(url, output_path)
    # 4. Save content.audio_path
    # 5. Create Transcription(content_item_id=..., status=PENDING)
    # 6. content.status = COMPLETED
    # 7. content.celery_task_id = None (pipeline done for content)
    # 8. Commit
    # 9. transcribe_content_task.delay(transcription.id)
    # 10. Update transcription.celery_task_id → commit
```

### transcribe_content_task (новый)

**Файл:** `app/worker/tasks/transcribe_content.py`

```python
@celery_app.task(
    bind=True, name="transcribe_content",
    max_retries=1, default_retry_delay=300,
    time_limit=7200, soft_time_limit=7100,   # 2 часа (3ч видео на CPU)
    queue="transcription",
)
def transcribe_content_task(self, transcription_id: int) -> dict:
    # 1. Load Transcription + ContentItem
    # 2. Check content.deleted_at
    # 3. transcription.status = PROCESSING
    # 4. Commit
    # 5. Verify audio file exists on disk
    # 6. WhisperTranscriber(model_size).transcribe(audio_path)
    # 7. Save text, language, duration_seconds, whisper_model
    # 8. transcription.status = COMPLETED
    # 9. Delete audio file from disk
    # 10. content.audio_path = None
    # 11. Commit
```

**time_limit=7200** (2 часа): модель `small` обрабатывает 3ч видео за ~60 мин на CPU. Запас 2x на медленные серверы.

---

## Repository + Service + Schema

### TranscriptionRepository

**Новый файл:** `app/repositories/transcription_repository.py`

```python
class TranscriptionRepository(BaseRepository[Transcription]):
    async def get_by_content_id(self, content_item_id: int) -> Transcription | None
    async def update_status(self, transcription, status, **kwargs) -> Transcription
    async def get_stuck_items(self, older_than_minutes: int) -> list[Transcription]
```

### TranscriptionService

**Новый файл:** `app/services/transcription_service.py`

```python
class TranscriptionService:
    async def get_transcription(self, workspace_id: int, content_id: int) -> Transcription
    async def retry_transcription(self, workspace_id: int, content_id: int) -> Transcription
```

### ContentService — обновления

**Файл:** `app/services/content_service.py`

Изменения:
- `delete_content()`: revoke все активные таски (content + transcription) + удалить audio файл
- `retry_content()`: определить упавший шаг, retry только его, НЕ пересоздавать Transcription
- `add_content()`: dispatch `parse_metadata_task` вместо `parse_content_task`

### Pydantic схемы

**Новый файл:** `app/schemas/transcription.py`

```python
class TranscriptionResponse(BaseModel):
    id: int
    content_item_id: int
    status: str
    text: str | None          # полный текст (может быть большим)
    language: str | None
    duration_seconds: int | None
    whisper_model: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime

class TranscriptionShortResponse(BaseModel):
    """Для вложения в ContentItemResponse — без полного текста."""
    status: str
    language: str | None
    duration_seconds: int | None
```

**Файл:** `app/schemas/content.py` — обновить:

```python
class ContentItemResponse(BaseModel):
    # ... существующие поля ...
    transcription: TranscriptionShortResponse | None = None  # NEW (nullable, backward-compatible)
```

### API эндпоинты

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| `GET` | `/workspaces/{wid}/content/{cid}/transcription` | member | Полный текст транскрипции |
| `POST` | `/workspaces/{wid}/content/{cid}/transcription/retry` | owner/admin/editor | Retry FAILED транскрибации |

---

## Хранение файлов и очистка

### Структура

```
/var/denco/audio/
└── {content_item_id}_{uuid4_short}.wav
```

- Директория создаётся при первом download (`os.makedirs(exist_ok=True)`)
- UUID в имени предотвращает перебор файлов

### Очистка (4 механизма)

1. **Успешная транскрибация** → `transcribe_content_task` удаляет audio, обнуляет `content.audio_path`
2. **Soft-delete content** → `delete_content()` удаляет audio файл
3. **FAILED транскрибация** → audio остаётся (для retry). Удаляется при retry или delete
4. **Orphaned files** → Celery-beat задача `cleanup_orphaned_audio` (раз в час): удалить файлы старше 24ч без привязки к записи

---

## Валидация ffmpeg на старте (бывший H7)

**Файл:** `app/worker/celery_app.py` — добавить сигнал `worker_ready`:

```python
@celery_app.on_after_configure.connect
def check_ffmpeg(**kwargs):
    """Проверить наличие ffmpeg при старте воркера."""
    import shutil
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg not found. Install: apt install ffmpeg")
```

---

## Sync DB pool (бывший M4)

Два типа тасков + recovery задача → больше concurrent connections.

```python
# app/worker/db.py
sync_engine = create_engine(
    ...,
    pool_size=10,      # было 5
    max_overflow=20,   # было 10
)
```

---

## Тесты

1. **Unit: WhisperTranscriber** — мок `whisper.load_model()` и `model.transcribe()`
2. **Unit: YouTubeParser.download_audio()** — мок `yt_dlp.YoutubeDL`
3. **Unit: TranscriptionService** — retry обновляет, не дублирует; get проверяет workspace
4. **Unit: ContentService.delete_content()** — revoke обоих тасков, удаление файла
5. **Unit: ContentService.retry_content()** — определение упавшего шага
6. **Integration: parse_metadata_task** — мок yt-dlp, проверка dispatch download
7. **Integration: download_audio_task** — мок yt-dlp, проверка создания Transcription
8. **Integration: transcribe_content_task** — мок whisper, проверка статусов и cleanup
9. **Integration: API endpoints** — AsyncClient, полный цикл

---

## Риски и митигация

| Риск | Severity | Митигация |
|------|----------|-----------|
| torch ~2 GB, Docker image раздувается | **HIGH** | Multi-stage build. Или отдельный image для transcription worker |
| CPU-only транскрибация медленная (3ч видео → ~60 мин) | **HIGH** | Модель `small`, time_limit=7200, отдельная очередь с -c 1 |
| Whisper OOM на длинных файлах | **HIGH** | `--max-memory-per-child=4000000`, мониторинг RSS |
| ffmpeg не установлен на сервере | **MEDIUM** | Валидация на старте worker (crash-fast) |
| Диск забивается WAV файлами (115 MB/час) | **MEDIUM** | Удаление после транскрибации + cron cleanup |
| Whisper model download при первом запуске (~244 MB) | **MEDIUM** | Pre-download в deploy скрипте или Dockerfile |
| Dispatch fail после commit (Redis down) | **MEDIUM** | Recovery task `recover_stuck_items` (Celery-beat, 10 мин) |
| yt-dlp blocked на некоторых видео | **LOW** | Graceful error → FAILED status |
| Whisper плохо распознаёт смешанный язык | **LOW** | `language` hint в будущем |

---

## Новые файлы

```
app/
├── models/transcription.py                # Transcription model
├── schemas/transcription.py               # Pydantic schemas
├── repositories/transcription_repository.py
├── services/transcription_service.py
├── api/transcription.py                   # API endpoints
├── integrations/whisper.py                # WhisperTranscriber
├── worker/tasks/download_audio.py         # download_audio_task
└── worker/tasks/transcribe_content.py     # transcribe_content_task

migrations/versions/xxx_add_transcriptions_and_downloading_status.py
```

Изменяемые файлы:
```
app/config.py                              # whisper settings, audio_storage_path
app/models/__init__.py                     # реэкспорт Transcription
app/models/content_item.py                 # +DOWNLOADING status, +relationship
app/schemas/content.py                     # +transcription field in response
app/integrations/youtube.py                # +download_audio()
app/worker/tasks/parse_content.py          # → rename to parse_metadata.py, simplify
app/worker/tasks/__init__.py               # +import new tasks
app/worker/celery_app.py                   # +task_routes, +ffmpeg check
app/worker/db.py                           # pool_size 5→10
app/services/content_service.py            # delete/retry updates
app/api/router.py                          # +transcription router
pyproject.toml                             # +openai-whisper
```
