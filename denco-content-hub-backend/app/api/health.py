import structlog
from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.common import HealthResponse

logger = structlog.get_logger()

router = APIRouter(tags=["health"])


async def _get_redis() -> Redis:
    from app.main import redis_pool

    return redis_pool


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    status_code=200,
)
async def health_check(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(_get_redis),
) -> HealthResponse:
    db_status = "ok"
    redis_status = "ok"

    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"
        logger.error("Database health check failed")

    try:
        await redis.ping()  # pyrefly: ignore[not-async]
    except Exception:
        redis_status = "error"
        logger.error("Redis health check failed")

    status = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"
    return HealthResponse(status=status, database=db_status, redis=redis_status)
