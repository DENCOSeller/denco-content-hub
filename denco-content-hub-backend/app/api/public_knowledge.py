from fastapi import APIRouter, Depends, Request
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_redis
from app.exceptions import RateLimitException
from app.schemas.common import ErrorResponse
from app.schemas.public_knowledge import PublicKnowledgeGraphResponse
from app.services.public_knowledge_service import PublicKnowledgeService

router = APIRouter(prefix="/public", tags=["Public Knowledge Graph"])

_RATE_LIMIT = 30
_RATE_WINDOW = 60  # seconds


async def _check_ip_rate_limit(request: Request, redis: Redis) -> None:
    ip = request.client.host if request.client else "unknown"
    key = f"rl:public_graph:{ip}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, _RATE_WINDOW)
    if count > _RATE_LIMIT:
        raise RateLimitException("Too many requests — please slow down")


@router.get(
    "/graph/{token}",
    response_model=PublicKnowledgeGraphResponse,
    summary="Get public knowledge graph by share token",
    tags=["Public Knowledge Graph"],
    responses={
        404: {"model": ErrorResponse, "description": "Token invalid, inactive, or expired"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded (30 req/min per IP)"},
    },
)
async def get_public_graph(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> PublicKnowledgeGraphResponse:
    await _check_ip_rate_limit(request, redis)
    service = PublicKnowledgeService(db)
    return await service.get_public_graph(token)
