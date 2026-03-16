from __future__ import annotations

from typing import TYPE_CHECKING

from app.config import settings
from app.repositories.ai_setting_repository import AiSettingRepository
from app.schemas.chat import AiSettingsResponse, AiSettingsUpdate

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

AI_SETTING_KEYS = [
    "ai_master_prompt",
    "ai_max_tool_rounds",
    "ai_max_history_messages",
    "ai_rate_limit_per_hour",
    "ai_max_sessions_shown",
    "ai_provider",
    "ai_model",
]

_INT_KEYS = {
    "ai_max_tool_rounds",
    "ai_max_history_messages",
    "ai_rate_limit_per_hour",
    "ai_max_sessions_shown",
}


async def get_settings(db: AsyncSession) -> AiSettingsResponse:
    """Get AI settings with DB override → config fallback."""
    repo = AiSettingRepository(db)
    db_settings = await repo.get_all_as_dict()

    def _get(key: str) -> str | int:
        raw = db_settings.get(key, getattr(settings, key))
        if key in _INT_KEYS and isinstance(raw, str):
            return int(raw)
        return raw

    return AiSettingsResponse(
        ai_master_prompt=_get("ai_master_prompt"),  # type: ignore[arg-type]
        ai_max_tool_rounds=_get("ai_max_tool_rounds"),  # type: ignore[arg-type]
        ai_max_history_messages=_get("ai_max_history_messages"),  # type: ignore[arg-type]
        ai_rate_limit_per_hour=_get("ai_rate_limit_per_hour"),  # type: ignore[arg-type]
        ai_max_sessions_shown=_get("ai_max_sessions_shown"),  # type: ignore[arg-type]
        ai_provider=_get("ai_provider"),  # type: ignore[arg-type]
        ai_model=_get("ai_model"),  # type: ignore[arg-type]
    )


async def update_settings(db: AsyncSession, data: AiSettingsUpdate, user_id: int) -> AiSettingsResponse:
    """Update only provided fields. Returns full settings after update."""
    repo = AiSettingRepository(db)
    updates = data.model_dump(exclude_none=True)

    for key, value in updates.items():
        await repo.upsert(key=key, value=str(value), user_id=user_id)

    await db.commit()
    return await get_settings(db)
