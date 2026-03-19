"""Репозиторий для работы с моделями Trend Discovery.

CRUD операции для TrendNiche, TrendItem, TrendSnapshot, TrendAlert.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import select, update

from app.exceptions import NotFoundException
from app.models.trend import (
    TrendAlert,
    TrendAlertSettings,
    TrendItem,
    TrendNiche,
    TrendSnapshot,
)
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams


class TrendItemFilters:
    """Фильтры для списка TrendItem."""

    def __init__(
        self,
        *,
        platform: str | None = None,
        niche_id: int | None = None,
        stage: str | None = None,
        min_viral_score: float | None = None,
        analysis_status: str | None = None,
    ) -> None:
        self.platform = platform
        self.niche_id = niche_id
        self.stage = stage
        self.min_viral_score = min_viral_score
        self.analysis_status = analysis_status


class TrendNicheRepository(BaseRepository[TrendNiche]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(TrendNiche, db)

    async def list_by_workspace(
        self,
        workspace_id: int,
        params: PaginationParams,
        *,
        active_only: bool = False,
    ) -> PaginatedResponse[TrendNiche]:
        query = self._base_query().where(TrendNiche.workspace_id == workspace_id)
        if active_only:
            query = query.where(TrendNiche.is_active.is_(True))
        query = query.order_by(TrendNiche.created_at.desc())
        return await self.paginate(query, params)

    async def get_active_niches(self, workspace_id: int) -> list[TrendNiche]:
        """Все активные ниши workspace (без пагинации, для фоновых задач)."""
        query = (
            self._base_query()
            .where(
                TrendNiche.workspace_id == workspace_id,
                TrendNiche.is_active.is_(True),
            )
            .order_by(TrendNiche.id)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())


class TrendItemRepository(BaseRepository[TrendItem]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(TrendItem, db)

    async def list_by_workspace(
        self,
        workspace_id: int,
        params: PaginationParams,
        filters: TrendItemFilters | None = None,
    ) -> PaginatedResponse[TrendItem]:
        query = self._base_query().where(TrendItem.workspace_id == workspace_id)
        query = self._apply_filters(query, filters)
        query = query.order_by(TrendItem.detected_at.desc())
        return await self.paginate(query, params)

    async def get_by_platform_post_id(
        self,
        workspace_id: int,
        platform: str,
        platform_post_id: str,
    ) -> TrendItem | None:
        query = self._base_query().where(
            TrendItem.workspace_id == workspace_id,
            TrendItem.platform == platform,
            TrendItem.platform_post_id == platform_post_id,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_by_niche(self, niche_id: int) -> list[TrendItem]:
        """Все TrendItem для ниши (без пагинации, для фоновых задач)."""
        query = self._base_query().where(TrendItem.niche_id == niche_id).order_by(TrendItem.detected_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def upsert_from_adapter(
        self,
        workspace_id: int,
        niche_id: int,
        data: dict[str, Any],
    ) -> tuple[TrendItem, bool]:
        """Создать или обновить TrendItem по platform_post_id.

        Returns:
            (TrendItem, is_new) — is_new=True если создан новый.
        """
        existing = await self.get_by_platform_post_id(
            workspace_id,
            data["platform"],
            data["platform_post_id"],
        )
        if existing:
            for key in ("views_count", "likes_count", "comments_count", "shares_count"):
                if key in data:
                    setattr(existing, key, data[key])
            await self.db.flush()
            await self.db.refresh(existing)
            return existing, False

        item = await self.create(
            workspace_id=workspace_id,
            niche_id=niche_id,
            **data,
        )
        return item, True

    @staticmethod
    def _apply_filters(
        query: select,  # type: ignore[type-arg]
        filters: TrendItemFilters | None,
    ) -> select:  # type: ignore[type-arg]
        if filters is None:
            return query
        if filters.platform is not None:
            query = query.where(TrendItem.platform == filters.platform)
        if filters.niche_id is not None:
            query = query.where(TrendItem.niche_id == filters.niche_id)
        if filters.stage is not None:
            query = query.where(TrendItem.stage == filters.stage)
        if filters.min_viral_score is not None:
            query = query.where(TrendItem.viral_score >= filters.min_viral_score)
        if filters.analysis_status is not None:
            query = query.where(TrendItem.analysis_status == filters.analysis_status)
        return query


class TrendSnapshotRepository:
    """Репозиторий для TrendSnapshot (без soft-delete, без BaseRepository)."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, **kwargs: Any) -> TrendSnapshot:
        snapshot = TrendSnapshot(**kwargs)
        self.db.add(snapshot)
        await self.db.flush()
        await self.db.refresh(snapshot)
        return snapshot

    async def list_by_trend_item(
        self,
        trend_item_id: int,
        limit: int = 100,
    ) -> list[TrendSnapshot]:
        query = (
            select(TrendSnapshot)
            .where(TrendSnapshot.trend_item_id == trend_item_id)
            .order_by(TrendSnapshot.recorded_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_latest(self, trend_item_id: int) -> TrendSnapshot | None:
        query = (
            select(TrendSnapshot)
            .where(TrendSnapshot.trend_item_id == trend_item_id)
            .order_by(TrendSnapshot.recorded_at.desc())
            .limit(1)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()


class TrendAlertRepository:
    """Репозиторий для TrendAlert (без soft-delete, без BaseRepository)."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, **kwargs: Any) -> TrendAlert:
        alert = TrendAlert(**kwargs)
        self.db.add(alert)
        await self.db.flush()
        await self.db.refresh(alert)
        return alert

    async def list_by_workspace(
        self,
        workspace_id: int,
        params: PaginationParams,
        *,
        unread_only: bool = False,
    ) -> PaginatedResponse[TrendAlert]:
        from sqlalchemy import func as sa_func

        from app.schemas.common import PaginatedResponse

        query = select(TrendAlert).where(TrendAlert.workspace_id == workspace_id)
        if unread_only:
            query = query.where(TrendAlert.is_read.is_(False))
        query = query.order_by(TrendAlert.created_at.desc())

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

    async def mark_as_read(self, alert_id: int) -> TrendAlert:
        query = select(TrendAlert).where(TrendAlert.id == alert_id)
        result = await self.db.execute(query)
        alert = result.scalar_one_or_none()
        if alert is None:
            raise NotFoundException("TrendAlert not found")
        alert.is_read = True
        alert.read_at = datetime.now(UTC)
        await self.db.flush()
        await self.db.refresh(alert)
        return alert

    async def bulk_mark_read(self, workspace_id: int) -> int:
        stmt = (
            update(TrendAlert)
            .where(
                TrendAlert.workspace_id == workspace_id,
                TrendAlert.is_read.is_(False),
            )
            .values(is_read=True, read_at=datetime.now(UTC))
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.rowcount  # type: ignore[return-value]


class TrendAlertSettingsRepository:
    """Репозиторий для TrendAlertSettings."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_workspace(self, workspace_id: int) -> TrendAlertSettings | None:
        query = select(TrendAlertSettings).where(
            TrendAlertSettings.workspace_id == workspace_id,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def upsert(
        self,
        workspace_id: int,
        **kwargs: Any,
    ) -> TrendAlertSettings:
        settings = await self.get_by_workspace(workspace_id)
        if settings is None:
            settings = TrendAlertSettings(workspace_id=workspace_id, **kwargs)
            self.db.add(settings)
        else:
            for key, value in kwargs.items():
                setattr(settings, key, value)
        await self.db.flush()
        await self.db.refresh(settings)
        return settings
