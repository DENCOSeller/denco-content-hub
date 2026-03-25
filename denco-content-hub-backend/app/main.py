from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis

from app.api.router import api_router
from app.config import settings
from app.exceptions import register_exception_handlers
from app.logging_config import setup_logging
from app.middleware import LoggingMiddleware, RequestIDMiddleware

logger = structlog.get_logger()

redis_pool: Redis = None  # type: ignore[assignment]


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
    global redis_pool

    setup_logging()
    redis_pool = Redis.from_url(settings.redis_url, decode_responses=True)

    # Синхронизация реестра модулей разрешений с БД
    import app.permissions.modules  # noqa: F401 — регистрация деклараций
    from app.permissions.sync import sync_module_registry

    await sync_module_registry()

    logger.info("Application started", app_name=settings.app_name)

    yield

    await redis_pool.aclose()
    logger.info("Application stopped")


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# Middleware (order matters: first added = outermost)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(LoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
register_exception_handlers(app)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    body = await request.body()
    errors = exc.errors()
    logger.error("Validation error", errors=errors, body=body.decode("utf-8", errors="replace")[:500])
    safe_errors = [
        {
            "type": e.get("type", "unknown"),
            "loc": e.get("loc", []),
            "msg": e.get("msg", "Validation error"),
        }
        for e in errors
    ]
    return JSONResponse(status_code=422, content={"detail": safe_errors})


# Routers
app.include_router(api_router)
