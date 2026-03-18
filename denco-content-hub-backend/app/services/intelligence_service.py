from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.config import settings
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

        # Если нет записи и flag OFF → adapter из старой таблицы
        if not settings.use_new_intelligence:
            adapted = await self._adapt_content_analysis(workspace_id, content_item_id)
            if adapted:
                return adapted

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

        # Если нет записи и flag OFF → adapter из старой таблицы
        if not settings.use_new_intelligence:
            adapted = await self._adapt_competitor_analysis(workspace_id, post_id)
            if adapted:
                return adapted

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

    # ── ADAPTERS (старые данные → IntelligenceResponse) ───────────────

    async def _adapt_content_analysis(
        self,
        workspace_id: int,
        content_item_id: int,
    ) -> IntelligenceResponse | None:
        """Маппинг ContentAnalysis → IntelligenceResponse."""
        from sqlalchemy import select

        from app.models.content_analysis import ContentAnalysis

        query = select(ContentAnalysis).where(ContentAnalysis.content_item_id == content_item_id)
        result = await self.db.execute(query)
        old = result.scalar_one_or_none()
        if not old or old.status != "completed":
            return None

        # Маппинг: theses → key_points
        key_points = None
        if old.theses:
            key_points = [
                {"point": t.get("title", t.get("description", "")), "importance": t.get("description")}
                for t in old.theses
            ]

        # hooks
        hooks = None
        if old.hooks:
            hooks = [{"hook": h if isinstance(h, str) else h.get("hook", ""), "explanation": ""} for h in old.hooks]

        # content_ideas из idea/angle (если были в content_ideas)
        content_ideas = None
        if old.content_ideas:
            content_ideas = [
                {"idea": ci.get("idea", ci.get("title", "")), "angle": ci.get("angle", ci.get("description", ""))}
                for ci in old.content_ideas
            ]

        return IntelligenceResponse(
            id=old.id,
            workspace_id=workspace_id,
            source_type="reference",
            content_item_id=content_item_id,
            summary=old.summary,
            key_points=key_points,
            hooks=hooks,
            content_ideas=content_ideas,
            status=old.status,
            error_message=old.error_message,
            created_at=old.created_at,
            updated_at=old.updated_at,
        )

    async def _adapt_competitor_analysis(
        self,
        workspace_id: int,
        post_id: int,
    ) -> IntelligenceResponse | None:
        """Маппинг CompetitorPostAnalysis → IntelligenceResponse."""
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        from app.models.competitor import CompetitorChannel, CompetitorPost

        query = (
            select(CompetitorPost)
            .options(selectinload(CompetitorPost.analysis))
            .join(CompetitorChannel, CompetitorPost.channel_id == CompetitorChannel.id)
            .where(
                CompetitorPost.id == post_id,
                CompetitorChannel.workspace_id == workspace_id,
                CompetitorChannel.deleted_at.is_(None),
            )
        )
        result = await self.db.execute(query)
        post = result.scalar_one_or_none()
        if not post or not post.analysis:
            return None

        old = post.analysis
        return IntelligenceResponse(
            id=old.id,
            workspace_id=workspace_id,
            source_type="competitor_post",
            competitor_post_id=post_id,
            summary=old.summary,
            key_points=old.key_points,
            hooks=old.hooks,
            topics=old.topics,
            tone=old.tone,
            quality_score=old.quality_score,
            content_ideas=old.content_ideas,
            content_structure=old.content_structure,
            status="completed",
            created_at=post.created_at,
            updated_at=post.updated_at,
        )
