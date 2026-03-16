from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.dependencies import require_platform_owner
from app.repositories.transcription_repository import TranscriptionRepository
from app.schemas.admin import ResetStuckResponse, StuckTranscriptionItem

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post(
    "/transcriptions/reset-stuck",
    response_model=ResetStuckResponse,
    summary="Reset stuck transcriptions to failed",
    status_code=200,
    responses={403: {"description": "Not a platform owner"}},
)
async def reset_stuck_transcriptions(
    threshold_minutes: int = Query(default=60, ge=10, le=1440),
    current_user: User = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
) -> ResetStuckResponse:
    """Reset transcriptions stuck in PROCESSING longer than threshold."""
    repo = TranscriptionRepository(db)
    stuck = await repo.reset_stuck(threshold_minutes)
    await db.commit()

    items = [
        StuckTranscriptionItem(
            transcription_id=t.id,
            content_item_id=t.content_item_id,
            stuck_since=t.updated_at,
        )
        for t in stuck
    ]
    return ResetStuckResponse(reset_count=len(items), items=items)
