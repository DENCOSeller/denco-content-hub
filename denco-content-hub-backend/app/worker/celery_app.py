import shutil

import structlog
from celery import Celery
from celery.signals import worker_ready

from app.config import settings

logger = structlog.get_logger()

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
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,
)

celery_app.conf.task_routes = {
    "parse_metadata": {"queue": "default"},
    "download_audio": {"queue": "default"},
    "transcribe_content": {"queue": "transcription"},
    "process_pdf": {"queue": "default"},
    "process_webpage": {"queue": "default"},
    "analyze_content": {"queue": "default"},
    "sync_competitor_channels": {"queue": "default"},
    "sync_single_competitor_channel": {"queue": "default"},
    "analyze_competitor_posts": {"queue": "default"},
    "take_channel_snapshots": {"queue": "default"},
}

celery_app.conf.beat_schedule = {
    "recover-stuck-items": {
        "task": "recover_stuck_items",
        "schedule": 600.0,
    },
    "sync-competitor-channels": {
        "task": "sync_competitor_channels",
        "schedule": 3600.0,  # Каждый час проверяем, какие каналы пора парсить
    },
    "analyze-competitor-posts": {
        "task": "analyze_competitor_posts",
        "schedule": 1800.0,  # Каждые 30 минут анализируем новые посты
    },
    "take-channel-snapshots": {
        "task": "take_channel_snapshots",
        "schedule": 86400.0,  # Раз в сутки (24 часа)
    },
}

celery_app.autodiscover_tasks(["app.worker.tasks"])


@worker_ready.connect
def check_ffmpeg_available(**kwargs: object) -> None:
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg not found. Install: apt install ffmpeg")
