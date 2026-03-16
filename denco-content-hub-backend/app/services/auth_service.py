from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

import structlog
from jose import JWTError

from app.exceptions import ConflictException, UnauthorizedException
from app.models.invitation import InvitationStatus
from app.repositories.company_repository import CompanyRepository
from app.repositories.invitation_repository import InvitationRepository
from app.repositories.user_repository import UserRepository
from app.repositories.workspace_member_repository import WorkspaceMemberRepository
from app.repositories.workspace_repository import WorkspaceRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services.workspace_service import WorkspaceService
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

if TYPE_CHECKING:
    from redis.asyncio import Redis
    from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()

DUMMY_HASH = "$2b$12$LJ3m4ys3Lg2nkYSBUgGyqu1I8I/3G6vCJHOg42RDkohla6.kmkBmq"


class AuthService:
    def __init__(self, db: AsyncSession, redis: Redis) -> None:
        self.db = db
        self.redis = redis
        self.user_repo = UserRepository(db)

    async def register(self, data: RegisterRequest) -> TokenResponse:
        existing = await self.user_repo.get_by_email(data.email)
        if existing:
            raise ConflictException("Email already registered")

        user = await self.user_repo.create(
            email=data.email,
            name=data.name,
            hashed_password=hash_password(data.password),
        )

        company_repo = CompanyRepository(self.db)
        default_company = await company_repo.get_default()

        workspace_service = WorkspaceService(self.db)
        await workspace_service.create_personal_workspace(user, company_id=default_company.id)

        await self._auto_accept_invitations(user.email, user.id)

        await self.db.commit()

        logger.info("User registered", user_id=user.id)
        return self._create_tokens(user.id)

    async def login(self, data: LoginRequest) -> TokenResponse:
        user = await self.user_repo.get_by_email(data.email)
        if not user:
            verify_password("fake", DUMMY_HASH)
            raise UnauthorizedException("Invalid email or password")

        if not verify_password(data.password, user.hashed_password):
            raise UnauthorizedException("Invalid email or password")

        if not user.is_active:
            raise UnauthorizedException("Account is deactivated")

        logger.info("User logged in", user_id=user.id)
        return self._create_tokens(user.id)

    async def refresh_tokens(self, refresh_token: str) -> TokenResponse:
        payload = self._decode_refresh_token(refresh_token)
        user_id = int(payload["sub"])

        is_blacklisted = await self.redis.get(f"blacklist:{refresh_token}")
        if is_blacklisted:
            raise UnauthorizedException("Token has been revoked")

        user = await self.user_repo.get_by_id_or_none(user_id)
        if not user or not user.is_active:
            raise UnauthorizedException("User not found or inactive")

        await self._blacklist_token(refresh_token, payload)

        logger.info("Tokens refreshed", user_id=user_id)
        return self._create_tokens(user_id)

    async def logout(self, refresh_token: str) -> None:
        payload = self._decode_refresh_token(refresh_token)
        await self._blacklist_token(refresh_token, payload)
        logger.info("User logged out", user_id=payload["sub"])

    async def _auto_accept_invitations(self, email: str, user_id: int) -> None:
        invitation_repo = InvitationRepository(self.db)
        member_repo = WorkspaceMemberRepository(self.db)
        workspace_repo = WorkspaceRepository(self.db)

        pending = await invitation_repo.get_pending_by_email(email)
        for inv in pending:
            ws = await workspace_repo.get_by_id_or_none(inv.workspace_id)
            if not ws or ws.deleted_at is not None:
                inv.status = InvitationStatus.CANCELLED
                continue
            existing = await member_repo.get_membership(user_id, inv.workspace_id)
            if existing:
                inv.status = InvitationStatus.CANCELLED
                continue
            await member_repo.add_member(user_id, inv.workspace_id, inv.role)
            inv.status = InvitationStatus.ACCEPTED
            logger.info("Invitation auto-accepted", user_id=user_id, workspace_id=inv.workspace_id)

    def _decode_refresh_token(self, token: str) -> dict:
        try:
            payload = decode_token(token)
        except JWTError as err:
            raise UnauthorizedException("Invalid token") from err

        if payload.get("type") != "refresh":
            raise UnauthorizedException("Invalid token type")
        return payload

    async def _blacklist_token(self, token: str, payload: dict) -> None:
        exp = payload.get("exp", 0)
        ttl = int(exp - datetime.now(UTC).timestamp())
        if ttl > 0:
            await self.redis.setex(f"blacklist:{token}", ttl, "1")

    @staticmethod
    def _create_tokens(user_id: int) -> TokenResponse:
        return TokenResponse(
            access_token=create_access_token(user_id),
            refresh_token=create_refresh_token(user_id),
        )
