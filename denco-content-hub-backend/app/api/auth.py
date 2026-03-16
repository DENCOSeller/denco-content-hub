from fastapi import APIRouter, Depends, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_redis
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.common import ErrorResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    responses={409: {"model": ErrorResponse, "description": "Email already registered"}},
)
async def register(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> TokenResponse:
    service = AuthService(db, redis)
    return await service.register(data)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with email and password",
    responses={401: {"model": ErrorResponse, "description": "Invalid credentials"}},
)
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> TokenResponse:
    service = AuthService(db, redis)
    return await service.login(data)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access and refresh tokens",
    responses={401: {"model": ErrorResponse, "description": "Invalid or revoked token"}},
)
async def refresh(
    data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> TokenResponse:
    service = AuthService(db, redis)
    return await service.refresh_tokens(data.refresh_token)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Logout and revoke refresh token",
    dependencies=[Depends(get_current_user)],
    responses={401: {"model": ErrorResponse, "description": "Not authenticated"}},
)
async def logout(
    data: RefreshRequest,
    redis: Redis = Depends(get_redis),
) -> None:
    service = AuthService(db=None, redis=redis)  # type: ignore[arg-type]
    await service.logout(data.refresh_token)
