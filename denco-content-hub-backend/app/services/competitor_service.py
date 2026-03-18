from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.exceptions import ConflictException, ForbiddenException
from app.integrations.competitor.url_resolver import resolve_url
from app.repositories.competitor_repository import CompetitorRepository
from app.repositories.workspace_member_repository import WorkspaceMemberRepository
from app.schemas.competitor import (
    CompetitorAnalysisResponse,
    CompetitorChannelResponse,
    CompetitorChannelSnapshotResponse,
    CompetitorChannelUpdate,
    CompetitorPostDetailResponse,
    CompetitorPostFilters,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.competitor import CompetitorPost
    from app.schemas.common import PaginatedResponse, PaginationParams

logger = structlog.get_logger()


class CompetitorService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = CompetitorRepository(db)
        self.member_repo = WorkspaceMemberRepository(db)

    async def get_channel_for_user(self, channel_id: int, user_id: int) -> CompetitorChannelResponse:
        """Получает канал и проверяет что пользователь — член workspace канала."""
        channel = await self.repo.get_by_id(channel_id)
        membership = await self.member_repo.get_membership(user_id, channel.workspace_id)
        if not membership:
            raise ForbiddenException("Нет доступа к этому каналу конкурента")
        return CompetitorChannelResponse.model_validate(channel)

    async def add_channel(
        self,
        workspace_id: int,
        user_id: int,
        url: str,
    ) -> CompetitorChannelResponse:
        platform, platform_id, handle = resolve_url(url)

        existing = await self.repo.get_channel_by_platform_id(workspace_id, platform.value, platform_id)
        if existing:
            raise ConflictException("Канал конкурента уже добавлен в этот workspace")

        channel = await self.repo.create(
            workspace_id=workspace_id,
            added_by_user_id=user_id,
            platform=platform.value,
            source_url=url,
            platform_id=platform_id,
            handle=handle,
        )
        await self.db.commit()
        await self.db.refresh(channel)

        logger.info(
            "Competitor channel added",
            channel_id=channel.id,
            workspace_id=workspace_id,
            platform=platform.value,
        )
        return CompetitorChannelResponse.model_validate(channel)

    async def list_channels(
        self,
        workspace_id: int,
        params: PaginationParams,
    ) -> PaginatedResponse[CompetitorChannelResponse]:
        page = await self.repo.get_channels_by_workspace(workspace_id, params)
        return page.model_copy(update={"items": [CompetitorChannelResponse.model_validate(ch) for ch in page.items]})

    async def get_channel(self, channel_id: int, user_id: int) -> CompetitorChannelResponse:
        return await self.get_channel_for_user(channel_id, user_id)

    async def update_channel(
        self,
        channel_id: int,
        user_id: int,
        data: CompetitorChannelUpdate,
    ) -> CompetitorChannelResponse:
        await self.get_channel_for_user(channel_id, user_id)
        update_data = data.model_dump(exclude_none=True)
        channel = await self.repo.update(channel_id, **update_data)
        await self.db.commit()
        await self.db.refresh(channel)
        return CompetitorChannelResponse.model_validate(channel)

    async def delete_channel(self, channel_id: int, user_id: int) -> None:
        await self.get_channel_for_user(channel_id, user_id)
        await self.repo.soft_delete(channel_id)
        await self.db.commit()
        logger.info("Competitor channel deleted", channel_id=channel_id)

    async def list_channel_snapshots(
        self,
        channel_id: int,
        user_id: int,
        days: int = 30,
    ) -> list[CompetitorChannelSnapshotResponse]:
        await self.get_channel_for_user(channel_id, user_id)
        snapshots = await self.repo.get_channel_snapshots(channel_id, days)
        return [CompetitorChannelSnapshotResponse.model_validate(s) for s in snapshots]

    async def list_posts(
        self,
        workspace_id: int,
        params: PaginationParams,
        filters: CompetitorPostFilters | None = None,
    ) -> PaginatedResponse:  # type: ignore[type-arg]
        return await self.repo.get_posts_by_workspace(workspace_id, params, filters)

    async def list_channel_posts(
        self,
        channel_id: int,
        user_id: int,
        params: PaginationParams,
        filters: CompetitorPostFilters | None = None,
    ) -> PaginatedResponse:  # type: ignore[type-arg]
        await self.get_channel_for_user(channel_id, user_id)
        return await self.repo.get_posts_by_channel(channel_id, params, filters)

    async def _check_post_access(self, post_id: int, user_id: int) -> CompetitorPost:
        """Загружает пост и проверяет что пользователь — член workspace канала."""
        post = await self.repo.get_post_with_analysis(post_id)
        channel = await self.repo.get_by_id(post.channel_id)
        membership = await self.member_repo.get_membership(user_id, channel.workspace_id)
        if not membership:
            raise ForbiddenException("Нет доступа к этому посту конкурента")
        return post

    async def get_post_analysis(self, post_id: int, user_id: int) -> CompetitorAnalysisResponse:
        """Получает анализ поста. Проверяет доступ через workspace канала."""
        from app.exceptions import NotFoundException

        await self._check_post_access(post_id, user_id)
        analysis = await self.repo.get_analysis_by_post_id(post_id)
        if analysis is None:
            raise NotFoundException("Анализ для этого поста ещё не готов")
        return CompetitorAnalysisResponse.model_validate(analysis)

    async def get_post_detail(self, post_id: int, user_id: int) -> CompetitorPostDetailResponse:
        post = await self._check_post_access(post_id, user_id)
        analysis = None
        if post.analysis:
            analysis = CompetitorAnalysisResponse.model_validate(post.analysis)
        return CompetitorPostDetailResponse(
            **{
                k: v
                for k, v in CompetitorPostDetailResponse.model_validate(post).model_dump().items()
                if k != "analysis"
            },
            analysis=analysis,
        )

    async def list_notifications(
        self,
        workspace_id: int,
        unread_only: bool,
        params: PaginationParams,
    ) -> PaginatedResponse:  # type: ignore[type-arg]
        return await self.repo.get_notifications(workspace_id, unread_only, params)

    async def mark_notification_read(self, notification_id: int, user_id: int) -> None:
        notification = await self.repo.mark_notification_read(notification_id)
        membership = await self.member_repo.get_membership(user_id, notification.workspace_id)
        if not membership:
            raise ForbiddenException("Нет доступа к этой нотификации")
        await self.db.commit()

    async def mark_all_notifications_read(self, workspace_id: int) -> None:
        await self.repo.mark_all_notifications_read(workspace_id)
        await self.db.commit()
