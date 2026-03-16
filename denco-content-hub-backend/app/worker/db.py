from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

# Celery worker uses SYNC engine (yt-dlp is blocking, no benefit from async)
sync_engine = create_engine(
    settings.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://"),
    pool_size=10,
    max_overflow=20,
)

SyncSessionLocal = sessionmaker(bind=sync_engine, class_=Session)
