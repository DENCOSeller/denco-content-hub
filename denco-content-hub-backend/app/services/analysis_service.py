from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from app.exceptions import NotFoundException
from app.models.content_analysis import ContentAnalysis
from app.repositories.analysis_repository import ContentAnalysisRepository
from app.repositories.content_repository import ContentRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


class ContentAnalysisService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.analysis_repo = ContentAnalysisRepository(db)
        self.content_repo = ContentRepository(db)

    async def get_analysis(self, workspace_id: int, content_id: int) -> ContentAnalysis:
        """Get analysis for a content item in workspace."""
        item = await self.content_repo.get_by_workspace_and_id(workspace_id, content_id)
        if not item:
            raise NotFoundException("Content not found")

        analysis = await self.analysis_repo.get_by_content_item_id(content_id)
        if not analysis:
            raise NotFoundException("Analysis not found")

        return analysis

    async def generate_analysis(
        self,
        workspace_id: int,
        content_id: int,
        force_regenerate: bool = False,
    ) -> ContentAnalysis:
        """Generate or regenerate content analysis."""
        item = await self.content_repo.get_by_workspace_and_id(workspace_id, content_id)
        if not item:
            raise NotFoundException("Content not found")

        existing = await self.analysis_repo.get_by_content_item_id(content_id)

        if existing and not force_regenerate:
            if existing.status == "completed":
                return existing
            if existing.status == "processing":
                return existing

        # Build kwargs for create_or_update
        kwargs: dict = {
            "status": "pending",
            "error_message": None,
        }
        if force_regenerate:
            kwargs.update(
                summary=None,
                theses=None,
                hooks=None,
                storyboard=None,
            )

        analysis = await self.analysis_repo.create_or_update(content_id, **kwargs)
        await self.db.commit()

        # Launch Celery task
        from app.worker.tasks.analyze_content import analyze_content_task

        task = analyze_content_task.delay(content_id)

        analysis.celery_task_id = task.id
        await self.db.commit()

        logger.info("Analysis generation started", content_id=content_id, workspace_id=workspace_id)
        return analysis
