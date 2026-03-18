from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.exceptions import NotFoundException
from app.models.competitor import (
    CompetitorChannel,
    CompetitorChannelSnapshot,
    CompetitorNotification,
    CompetitorPost,
    CompetitorPostAnalysis,
)
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams
    from app.schemas.competitor import CompetitorPostFilters


class CompetitorRepository(BaseRepository[CompetitorChannel]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(CompetitorChannel, db)

    async def get_channels_by_workspace(
        self,
        workspace_id: int,
        params: PaginationParams,
    ) -> PaginatedResponse[CompetitorChannel]:
        query = (
            self._base_query()
            .where(CompetitorChannel.workspace_id == workspace_id)
            .order_by(CompetitorChannel.created_at.desc())
        )
        return await self.paginate(query, params)

    async def get_channel_by_platform_id(
        self,
        workspace_id: int,
        platform: str,
        platform_id: str,
    ) -> CompetitorChannel | None:
        query = self._base_query().where(
            CompetitorChannel.workspace_id == workspace_id,
            CompetitorChannel.platform == platform,
            CompetitorChannel.platform_id == platform_id,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_posts_by_channel(
        self,
        channel_id: int,
        params: PaginationParams,
        filters: CompetitorPostFilters | None = None,
    ) -> PaginatedResponse[CompetitorPost]:
        query = select(CompetitorPost).where(CompetitorPost.channel_id == channel_id)
        query = self._apply_post_filters(query, filters)
        query = query.order_by(CompetitorPost.published_at.desc())
        return await self._paginate_model(query, params)

    async def get_posts_by_workspace(
        self,
        workspace_id: int,
        params: PaginationParams,
        filters: CompetitorPostFilters | None = None,
    ) -> PaginatedResponse[CompetitorPost]:
        query = (
            select(CompetitorPost)
            .join(
                CompetitorChannel,
                CompetitorPost.channel_id == CompetitorChannel.id,
            )
            .where(
                CompetitorChannel.workspace_id == workspace_id,
                CompetitorChannel.deleted_at.is_(None),
            )
        )
        query = self._apply_post_filters(query, filters)
        query = query.order_by(CompetitorPost.published_at.desc())
        return await self._paginate_model(query, params)

    async def get_post_with_analysis(self, post_id: int) -> CompetitorPost:
        query = (
            select(CompetitorPost).options(selectinload(CompetitorPost.analysis)).where(CompetitorPost.id == post_id)
        )
        result = await self.db.execute(query)
        post = result.scalar_one_or_none()
        if post is None:
            raise NotFoundException("Competitor post not found")
        return post

    async def get_analysis_by_post_id(self, post_id: int) -> CompetitorPostAnalysis | None:
        query = select(CompetitorPostAnalysis).where(CompetitorPostAnalysis.post_id == post_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_notifications(
        self,
        workspace_id: int,
        unread_only: bool,
        params: PaginationParams,
    ) -> PaginatedResponse[CompetitorNotification]:
        query = select(CompetitorNotification).where(CompetitorNotification.workspace_id == workspace_id)
        if unread_only:
            query = query.where(CompetitorNotification.is_read.is_(False))
        query = query.order_by(CompetitorNotification.created_at.desc())
        return await self._paginate_model(query, params)

    async def mark_notification_read(self, notification_id: int) -> CompetitorNotification:
        query = select(CompetitorNotification).where(CompetitorNotification.id == notification_id)
        result = await self.db.execute(query)
        notification = result.scalar_one_or_none()
        if notification is None:
            raise NotFoundException("Notification not found")
        notification.is_read = True
        notification.read_at = datetime.now(UTC)
        await self.db.flush()
        await self.db.refresh(notification)
        return notification

    async def mark_all_notifications_read(self, workspace_id: int) -> int:
        stmt = (
            update(CompetitorNotification)
            .where(
                CompetitorNotification.workspace_id == workspace_id,
                CompetitorNotification.is_read.is_(False),
            )
            .values(is_read=True, read_at=datetime.now(UTC))
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.rowcount  # type: ignore[return-value]

    async def get_channel_snapshots(
        self,
        channel_id: int,
        days: int = 30,
    ) -> list[CompetitorChannelSnapshot]:
        threshold = datetime.now(UTC) - timedelta(days=days)
        query = (
            select(CompetitorChannelSnapshot)
            .where(
                CompetitorChannelSnapshot.channel_id == channel_id,
                CompetitorChannelSnapshot.recorded_at >= threshold,
            )
            .order_by(CompetitorChannelSnapshot.recorded_at.asc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _apply_post_filters(
        query: select,  # type: ignore[type-arg]
        filters: CompetitorPostFilters | None,
    ) -> select:  # type: ignore[type-arg]
        if filters is None:
            return query
        if filters.channel_id is not None:
            query = query.where(CompetitorPost.channel_id == filters.channel_id)
        if filters.content_type is not None:
            query = query.where(CompetitorPost.content_type == filters.content_type)
        if filters.analysis_status is not None:
            query = query.where(CompetitorPost.analysis_status == filters.analysis_status)
        if filters.min_views is not None:
            query = query.where(CompetitorPost.views_count >= filters.min_views)
        return query

    async def _paginate_model(
        self,
        query: select,  # type: ignore[type-arg]
        params: PaginationParams,
    ) -> PaginatedResponse:  # type: ignore[type-arg]
        from sqlalchemy import func as sa_func

        from app.schemas.common import PaginatedResponse

        count_query = select(sa_func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        paginated = query.offset(params.offset).limit(params.size)
        result = await self.db.execute(paginated)
        items = list(result.scalars().all())

        pages = (total + params.size - 1) // params.size if total > 0 else 0

        return PaginatedResponse(
            items=items,
            total=total,
            page=params.page,
            size=params.size,
            pages=pages,
        )
