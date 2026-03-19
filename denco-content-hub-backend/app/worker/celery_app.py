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
    "sync_competitor_channels": {"queue": "default"},
    "sync_single_competitor_channel": {"queue": "default"},
    "analyze_reference_intelligence": {"queue": "default"},
    "analyze_competitor_post_intelligence": {"queue": "default"},
    "analyze_competitor_batch_intelligence": {"queue": "default"},
    "analyze_trend_item_intelligence": {"queue": "default"},
    "analyze_trend_batch_intelligence": {"queue": "default"},
    "take_channel_snapshots": {"queue": "default"},
    "discover_trends_batch": {"queue": "default"},
    "monitor_trend_snapshots": {"queue": "default"},
    "check_trend_alerts": {"queue": "default"},
    "cleanup_old_trends": {"queue": "default"},
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
    "take-channel-snapshots": {
        "task": "take_channel_snapshots",
        "schedule": 86400.0,  # Раз в сутки (24 часа)
    },
    "discover-trends-batch": {
        "task": "discover_trends_batch",
        "schedule": 7200.0,  # Каждые 2 часа
    },
    "monitor-trend-snapshots": {
        "task": "monitor_trend_snapshots",
        "schedule": 14400.0,  # Каждые 4 часа
    },
    "check-trend-alerts": {
        "task": "check_trend_alerts",
        "schedule": 3600.0,  # Каждый час
    },
    "cleanup-old-trends": {
        "task": "cleanup_old_trends",
        "schedule": 86400.0,  # Раз в день
    },
    "analyze-trend-batch-intelligence": {
        "task": "analyze_trend_batch_intelligence",
        "schedule": 1800.0,  # Каждые 30 минут
    },
}

celery_app.autodiscover_tasks(["app.worker.tasks"])


@worker_ready.connect
def check_ffmpeg_available(**kwargs: object) -> None:
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg not found. Install: apt install ffmpeg")
