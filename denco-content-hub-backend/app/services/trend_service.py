"""TrendDiscoveryService — оркестрация модуля Trend Discovery.

Управление нишами, обнаружение трендов, обновление snapshots, линковка
с CompetitorPost и генерация алертов.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

import structlog

from app.integrations.trend_discovery.instagram_trends import (
    ApifyInstagramTrendProvider,
)
from app.integrations.trend_discovery.youtube_trends import YouTubeTrendDiscovery
from app.models.trend import TrendAlertType
from app.repositories.trend_repository import (
    TrendAlertRepository,
    TrendAlertSettingsRepository,
    TrendItemRepository,
    TrendNicheRepository,
    TrendSnapshotRepository,
)
from app.services.trend_scorer import TrendScorer

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.trend import (
        TrendAlert,
        TrendAlertSettings,
        TrendItem,
        TrendNiche,
        TrendSnapshot,
    )
    from app.schemas.common import PaginatedResponse, PaginationParams

logger = structlog.get_logger()

# Порог viral_score для создания алерта "viral_trend"
VIRAL_SCORE_THRESHOLD = 70.0
# Порог viral_score для алерта "new_trend" (новый тренд с хорошим стартом)
NEW_TREND_SCORE_THRESHOLD = 40.0


class TrendDiscoveryService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.niche_repo = TrendNicheRepository(db)
        self.item_repo = TrendItemRepository(db)
        self.snapshot_repo = TrendSnapshotRepository(db)
        self.alert_repo = TrendAlertRepository(db)
        self.alert_settings_repo = TrendAlertSettingsRepository(db)
        self.scorer = TrendScorer()

    # ------------------------------------------------------------------
    # Управление нишами
    # ------------------------------------------------------------------

    async def create_niche(
        self,
        workspace_id: int,
        *,
        name: str,
        keywords: list[str],
        platforms: list[str],
        monitoring_interval_hours: int = 4,
    ) -> TrendNiche:
        niche = await self.niche_repo.create(
            workspace_id=workspace_id,
            name=name,
            keywords=keywords,
            platforms=platforms,
            monitoring_interval_hours=monitoring_interval_hours,
        )
        await self.db.commit()
        await self.db.refresh(niche)
        logger.info("Trend niche created", niche_id=niche.id, workspace_id=workspace_id)
        return niche

    async def update_niche(self, niche_id: int, **kwargs: Any) -> TrendNiche:
        niche = await self.niche_repo.update(niche_id, **kwargs)
        await self.db.commit()
        await self.db.refresh(niche)
        logger.info("Trend niche updated", niche_id=niche_id)
        return niche

    async def delete_niche(self, niche_id: int) -> None:
        await self.niche_repo.get_by_id(niche_id)
        niche = await self.niche_repo.update(niche_id, is_active=False)
        await self.db.commit()
        logger.info("Trend niche deactivated", niche_id=niche.id)

    async def list_niches(
        self,
        workspace_id: int,
        params: PaginationParams,
        *,
        active_only: bool = False,
    ) -> PaginatedResponse[TrendNiche]:
        return await self.niche_repo.list_by_workspace(
            workspace_id,
            params,
            active_only=active_only,
        )

    async def get_niche(self, niche_id: int) -> TrendNiche:
        return await self.niche_repo.get_by_id(niche_id)

    # ------------------------------------------------------------------
    # Обнаружение трендов
    # ------------------------------------------------------------------

    async def discover_trends_for_niche(self, niche_id: int) -> list[TrendItem]:
        """Запуск адаптеров для обнаружения трендов по нише.

        Получает данные из YouTube/Instagram → upsert TrendItem →
        расчёт scores → создание snapshot.
        """
        niche = await self.niche_repo.get_by_id(niche_id)
        platforms = niche.platforms or []
        keywords = niche.keywords or []

        if not keywords:
            logger.warning("Niche has no keywords", niche_id=niche_id)
            return []

        raw_items: list[dict[str, Any]] = []

        # YouTube (синхронный адаптер — оборачиваем в to_thread)
        if "youtube" in platforms:
            raw_items.extend(
                await self._discover_youtube(keywords),
            )

        # Instagram (асинхронный адаптер)
        if "instagram" in platforms:
            raw_items.extend(
                await self._discover_instagram(keywords),
            )

        if not raw_items:
            logger.info("No trend items discovered", niche_id=niche_id)
            return []

        # Upsert + scoring
        created_items: list[TrendItem] = []
        for raw in raw_items:
            item, _is_new = await self.item_repo.upsert_from_adapter(
                workspace_id=niche.workspace_id,
                niche_id=niche.id,
                data=raw,
            )
            scores = self._compute_scores(item, previous_snapshot=None)
            await self._apply_scores(item, scores)
            await self._create_snapshot(item, scores)
            await self._try_link_competitor_post(item)
            created_items.append(item)

        await self.db.commit()
        logger.info(
            "Trend discovery completed",
            niche_id=niche_id,
            total=len(created_items),
        )
        return created_items

    async def _discover_youtube(self, keywords: list[str]) -> list[dict[str, Any]]:
        """Вызов YouTube адаптера с обработкой ошибок."""
        try:
            yt = YouTubeTrendDiscovery()
            results = await asyncio.to_thread(yt.discover_by_niche, keywords)
            logger.info("YouTube discovery done", count=len(results))
            return results
        except Exception:
            logger.exception("YouTube discovery failed")
            return []

    async def _discover_instagram(self, keywords: list[str]) -> list[dict[str, Any]]:
        """Вызов Instagram адаптера с обработкой ошибок."""
        try:
            ig = ApifyInstagramTrendProvider()
            results = await ig.discover_reels_by_keyword(keywords)
            logger.info("Instagram discovery done", count=len(results))
            return results
        except Exception:
            logger.exception("Instagram discovery failed")
            return []

    # ------------------------------------------------------------------
    # Обновление snapshots
    # ------------------------------------------------------------------

    async def update_trend_snapshots(self, niche_id: int) -> int:
        """Обновить метрики существующих трендов, пересчитать scores и стадии.

        Returns:
            Количество обновлённых TrendItem.
        """
        niche = await self.niche_repo.get_by_id(niche_id)
        items = await self.item_repo.list_by_niche(niche_id)

        if not items:
            return 0

        # Собираем platform_post_id для обновления метрик
        yt_ids = [it.platform_post_id for it in items if it.platform == "youtube"]
        ig_ids = [it.platform_post_id for it in items if it.platform == "instagram"]

        fresh_stats = await self._fetch_fresh_stats(yt_ids, niche.keywords, ig_ids)

        updated = 0
        for item in items:
            new_data = fresh_stats.get(f"{item.platform}:{item.platform_post_id}")
            if not new_data:
                continue

            previous_snapshot = await self.snapshot_repo.get_latest(item.id)
            self._update_item_metrics(item, new_data)
            scores = self._compute_scores(item, previous_snapshot)
            await self._apply_scores(item, scores)
            await self._create_snapshot(item, scores)
            updated += 1

        await self.db.commit()
        logger.info(
            "Trend snapshots updated",
            niche_id=niche_id,
            updated=updated,
            total=len(items),
        )
        return updated

    async def _fetch_fresh_stats(
        self,
        yt_ids: list[str],
        keywords: list[str],
        ig_ids: list[str],
    ) -> dict[str, dict[str, Any]]:
        """Получить свежие метрики с платформ. Ключ: 'platform:post_id'."""
        stats: dict[str, dict[str, Any]] = {}

        if yt_ids:
            try:
                yt = YouTubeTrendDiscovery()
                yt_results = await asyncio.to_thread(yt.fetch_video_stats, yt_ids)
                for r in yt_results:
                    key = f"youtube:{r['platform_post_id']}"
                    stats[key] = r
            except Exception:
                logger.exception("YouTube stats fetch failed")

        # Instagram не поддерживает fetch по ID — пропускаем обновление
        # (данные обновятся при следующем discover)

        return stats

    # ------------------------------------------------------------------
    # Scoring helpers
    # ------------------------------------------------------------------

    def _compute_scores(
        self,
        item: TrendItem,
        previous_snapshot: TrendSnapshot | None,
    ) -> dict[str, Any]:
        """Рассчитать scores через TrendScorer."""
        now = datetime.now(UTC)
        age_hours = 0.0
        if item.published_at:
            delta = now - item.published_at
            age_hours = delta.total_seconds() / 3600.0

        current_metrics = {
            "views": item.views_count or 0,
            "likes": item.likes_count or 0,
            "comments": item.comments_count or 0,
            "shares": item.shares_count or 0,
            "age_hours": age_hours,
        }

        previous_metrics: dict[str, Any] | None = None
        hours_elapsed = 0.0

        if previous_snapshot:
            previous_metrics = {
                "views": previous_snapshot.views_count or 0,
                "velocity": previous_snapshot.velocity or 0.0,
            }
            delta_snap = now - previous_snapshot.recorded_at
            hours_elapsed = delta_snap.total_seconds() / 3600.0

        return self.scorer.score_trend(current_metrics, previous_metrics, hours_elapsed)

    async def _apply_scores(self, item: TrendItem, scores: dict[str, Any]) -> None:
        """Применить рассчитанные scores к TrendItem."""
        item.velocity = scores["velocity"]
        item.acceleration = scores["acceleration"]
        item.er_score = scores["er_score"]
        item.viral_score = scores["viral_score"]
        item.stage = scores["stage"]
        await self.db.flush()

    async def _create_snapshot(
        self,
        item: TrendItem,
        scores: dict[str, Any],
    ) -> TrendSnapshot:
        """Создать TrendSnapshot с текущими метриками."""
        return await self.snapshot_repo.create(
            trend_item_id=item.id,
            views_count=item.views_count,
            likes_count=item.likes_count,
            comments_count=item.comments_count,
            velocity=scores["velocity"],
            viral_score=scores["viral_score"],
        )

    @staticmethod
    def _update_item_metrics(item: TrendItem, data: dict[str, Any]) -> None:
        """Обновить метрики TrendItem из свежих данных адаптера."""
        for key in ("views_count", "likes_count", "comments_count", "shares_count"):
            if key in data:
                setattr(item, key, data[key])

    # ------------------------------------------------------------------
    # Линковка с CompetitorPost
    # ------------------------------------------------------------------

    async def _try_link_competitor_post(self, item: TrendItem) -> None:
        """Если platform_post_id совпадает с CompetitorPost — установить FK."""
        if item.competitor_post_id is not None:
            return

        from sqlalchemy import select

        from app.models.competitor import CompetitorPost

        query = (
            select(CompetitorPost.id)
            .where(
                CompetitorPost.platform_post_id == item.platform_post_id,
            )
            .limit(1)
        )
        result = await self.db.execute(query)
        post_id = result.scalar_one_or_none()

        if post_id:
            item.competitor_post_id = post_id
            await self.db.flush()
            logger.info(
                "Trend item linked to competitor post",
                trend_item_id=item.id,
                competitor_post_id=post_id,
            )

    # ------------------------------------------------------------------
    # Алерты
    # ------------------------------------------------------------------

    async def check_and_create_alerts(self, workspace_id: int) -> list[TrendAlert]:
        """Проверить тренды workspace и создать алерты при превышении порогов."""
        # Новые тренды с высоким viral_score
        viral_items = await self._get_unalerted_items(
            workspace_id,
            min_score=VIRAL_SCORE_THRESHOLD,
            alert_type=TrendAlertType.viral_trend,
        )
        new_items = await self._get_unalerted_items(
            workspace_id,
            min_score=NEW_TREND_SCORE_THRESHOLD,
            alert_type=TrendAlertType.new_trend,
        )

        alerts: list[TrendAlert] = []

        for item in viral_items:
            alert = await self.alert_repo.create(
                workspace_id=workspace_id,
                niche_id=item.niche_id,
                trend_item_id=item.id,
                alert_type=TrendAlertType.viral_trend,
                title=f"Вирусный тренд: {item.title or item.platform_post_id}",
                body=f"viral_score={item.viral_score}, platform={item.platform}",
                threshold_triggered={
                    "metric": "viral_score",
                    "threshold": VIRAL_SCORE_THRESHOLD,
                    "value": item.viral_score,
                },
            )
            alerts.append(alert)

        for item in new_items:
            alert = await self.alert_repo.create(
                workspace_id=workspace_id,
                niche_id=item.niche_id,
                trend_item_id=item.id,
                alert_type=TrendAlertType.new_trend,
                title=f"Новый тренд: {item.title or item.platform_post_id}",
                body=f"viral_score={item.viral_score}, stage={item.stage}",
                threshold_triggered={
                    "metric": "viral_score",
                    "threshold": NEW_TREND_SCORE_THRESHOLD,
                    "value": item.viral_score,
                },
            )
            alerts.append(alert)

        if alerts:
            await self.db.commit()
            logger.info(
                "Trend alerts created",
                workspace_id=workspace_id,
                count=len(alerts),
            )

        return alerts

    async def _get_unalerted_items(
        self,
        workspace_id: int,
        *,
        min_score: float,
        alert_type: str,
    ) -> list[TrendItem]:
        """TrendItem с viral_score >= порога, для которых ещё нет алерта данного типа."""
        from sqlalchemy import select

        from app.models.trend import TrendAlert as TrendAlertModel
        from app.models.trend import TrendItem as TrendItemModel

        # Подзапрос: id трендов у которых уже есть алерт этого типа
        alerted_subq = (
            select(TrendAlertModel.trend_item_id)
            .where(
                TrendAlertModel.workspace_id == workspace_id,
                TrendAlertModel.alert_type == alert_type,
            )
            .correlate(TrendItemModel)
            .scalar_subquery()
        )

        query = (
            select(TrendItemModel)
            .where(
                TrendItemModel.workspace_id == workspace_id,
                TrendItemModel.viral_score >= min_score,
                TrendItemModel.id.notin_(alerted_subq),
            )
            .order_by(TrendItemModel.viral_score.desc())
            .limit(50)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Управление алертами
    # ------------------------------------------------------------------

    async def list_alerts(
        self,
        workspace_id: int,
        params: PaginationParams,
        *,
        unread_only: bool = False,
    ) -> PaginatedResponse[TrendAlert]:
        return await self.alert_repo.list_by_workspace(
            workspace_id,
            params,
            unread_only=unread_only,
        )

    async def get_alert(self, alert_id: int) -> TrendAlert:
        from sqlalchemy import select

        from app.exceptions import NotFoundException
        from app.models.trend import TrendAlert

        query = select(TrendAlert).where(TrendAlert.id == alert_id)
        result = await self.db.execute(query)
        alert = result.scalar_one_or_none()
        if alert is None:
            raise NotFoundException("TrendAlert not found")
        return alert

    async def mark_alert_read(self, alert_id: int) -> TrendAlert:
        alert = await self.alert_repo.mark_as_read(alert_id)
        await self.db.commit()
        return alert

    async def mark_all_alerts_read(self, workspace_id: int) -> int:
        count = await self.alert_repo.bulk_mark_read(workspace_id)
        await self.db.commit()
        return count

    async def get_alert_settings(self, workspace_id: int) -> TrendAlertSettings:
        settings = await self.alert_settings_repo.get_by_workspace(workspace_id)
        if settings is not None:
            return settings
        settings = await self.alert_settings_repo.upsert(workspace_id)
        await self.db.commit()
        await self.db.refresh(settings)
        return settings

    async def update_alert_settings(
        self,
        workspace_id: int,
        **kwargs: Any,
    ) -> TrendAlertSettings:
        settings = await self.alert_settings_repo.upsert(workspace_id, **kwargs)
        await self.db.commit()
        await self.db.refresh(settings)
        logger.info(
            "Alert settings updated",
            workspace_id=workspace_id,
        )
        return settings

    # ------------------------------------------------------------------
    # Список трендов
    # ------------------------------------------------------------------

    async def list_trend_items(
        self,
        workspace_id: int,
        params: PaginationParams,
        filters: Any = None,
    ) -> PaginatedResponse[TrendItem]:
        return await self.item_repo.list_by_workspace(workspace_id, params, filters)

    async def get_trend_item(self, item_id: int) -> TrendItem:
        return await self.item_repo.get_by_id(item_id)

    async def list_snapshots(
        self,
        trend_item_id: int,
        limit: int = 100,
    ) -> list[TrendSnapshot]:
        return await self.snapshot_repo.list_by_trend_item(trend_item_id, limit)
