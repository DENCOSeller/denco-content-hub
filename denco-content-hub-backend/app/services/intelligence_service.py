from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.exceptions import NotFoundException
from app.integrations.content_intelligence.schemas import IntelligenceResponse
from app.repositories.intelligence_repository import IntelligenceRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.content_intelligence import ContentIntelligence

logger = structlog.get_logger()


class IntelligenceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = IntelligenceRepository(db)

    # ── GET ───────────────────────────────────────────────────────────

    async def get_reference_intelligence(
        self,
        workspace_id: int,
        content_item_id: int,
    ) -> IntelligenceResponse:
        """Получить intelligence для reference (ContentItem)."""
        record = await self.repo.get_by_content_item(content_item_id)

        if record and record.workspace_id == workspace_id:
            return IntelligenceResponse.model_validate(record)

        raise NotFoundException("Intelligence analysis not found")

    async def get_competitor_intelligence(
        self,
        workspace_id: int,
        post_id: int,
    ) -> IntelligenceResponse:
        """Получить intelligence для competitor post."""
        record = await self.repo.get_by_competitor_post(post_id)

        if record and record.workspace_id == workspace_id:
            return IntelligenceResponse.model_validate(record)

        raise NotFoundException("Intelligence analysis not found")

    async def get_trend_item_intelligence(
        self,
        workspace_id: int,
        trend_item_id: int,
    ) -> IntelligenceResponse:
        """Получить intelligence для trend item."""
        record = await self.repo.get_by_trend_item(trend_item_id)

        if record and record.workspace_id == workspace_id:
            return IntelligenceResponse.model_validate(record)

        raise NotFoundException("Intelligence analysis not found")

    # ── GENERATE ──────────────────────────────────────────────────────

    async def generate_reference_intelligence(
        self,
        workspace_id: int,
        content_item_id: int,
        force: bool = False,
    ) -> ContentIntelligence:
        """Запустить Celery task для анализа reference."""
        from app.repositories.content_repository import ContentRepository

        content_repo = ContentRepository(self.db)
        item = await content_repo.get_by_workspace_and_id(workspace_id, content_item_id)
        if not item:
            raise NotFoundException("Content not found")

        existing = await self.repo.get_by_content_item(content_item_id)
        if existing and not force and existing.status in ("completed", "processing"):
            return existing

        record = await self.repo.create_or_update(
            source_type="reference",
            source_id_field="content_item_id",
            source_id=content_item_id,
            workspace_id=workspace_id,
            status="pending",
            error_message=None,
        )
        await self.db.commit()

        from app.worker.tasks.intelligence_pipeline import analyze_reference_intelligence

        task = analyze_reference_intelligence.delay(content_item_id)
        logger.info(
            "Reference intelligence task started",
            content_item_id=content_item_id,
            task_id=task.id,
        )
        return record

    async def generate_competitor_intelligence(
        self,
        workspace_id: int,
        post_id: int,
        force: bool = False,
    ) -> ContentIntelligence:
        """Запустить Celery task для анализа competitor post."""
        from sqlalchemy import select

        from app.models.competitor import CompetitorChannel, CompetitorPost

        query = (
            select(CompetitorPost)
            .join(CompetitorChannel, CompetitorPost.channel_id == CompetitorChannel.id)
            .where(
                CompetitorPost.id == post_id,
                CompetitorChannel.workspace_id == workspace_id,
                CompetitorChannel.deleted_at.is_(None),
            )
        )
        result = await self.db.execute(query)
        post = result.scalar_one_or_none()
        if not post:
            raise NotFoundException("Competitor post not found")

        existing = await self.repo.get_by_competitor_post(post_id)
        if existing and not force and existing.status in ("completed", "processing"):
            return existing

        record = await self.repo.create_or_update(
            source_type="competitor_post",
            source_id_field="competitor_post_id",
            source_id=post_id,
            workspace_id=workspace_id,
            status="pending",
            error_message=None,
        )
        await self.db.commit()

        from app.worker.tasks.intelligence_pipeline import (
            analyze_competitor_post_intelligence,
        )

        task = analyze_competitor_post_intelligence.delay(post_id)
        logger.info(
            "Competitor intelligence task started",
            post_id=post_id,
            task_id=task.id,
        )
        return record

    async def generate_trend_item_intelligence(
        self,
        workspace_id: int,
        trend_item_id: int,
        force: bool = False,
    ) -> ContentIntelligence:
        """Запустить Celery task для анализа trend item."""
        from sqlalchemy import select

        from app.models.trend import TrendItem

        query = select(TrendItem).where(
            TrendItem.id == trend_item_id,
            TrendItem.workspace_id == workspace_id,
        )
        result = await self.db.execute(query)
        item = result.scalar_one_or_none()
        if not item:
            raise NotFoundException("Trend item not found")

        existing = await self.repo.get_by_trend_item(trend_item_id)
        if existing and not force and existing.status in ("completed", "processing"):
            return existing

        record = await self.repo.create_or_update(
            source_type="trend_item",
            source_id_field="trend_item_id",
            source_id=trend_item_id,
            workspace_id=workspace_id,
            status="pending",
            error_message=None,
        )
        await self.db.commit()

        from app.worker.tasks.intelligence_pipeline import (
            analyze_trend_item_intelligence,
        )

        task = analyze_trend_item_intelligence.delay(trend_item_id)
        logger.info(
            "Trend item intelligence task started",
            trend_item_id=trend_item_id,
            task_id=task.id,
        )
        return record
