from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from app.models.chat import AiSetting
from app.repositories.base import BaseRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class AiSettingRepository(BaseRepository[AiSetting]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(AiSetting, db)

    async def get_all_as_dict(self) -> dict[str, str]:
        query = select(AiSetting.key, AiSetting.value)
        result = await self.db.execute(query)
        return {row[0]: row[1] for row in result.all()}

    async def upsert(self, key: str, value: str, user_id: int) -> AiSetting:
        query = select(AiSetting).where(AiSetting.key == key)
        result = await self.db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            existing.value = value
            existing.updated_by_user_id = user_id
            await self.db.flush()
            await self.db.refresh(existing)
            return existing

        return await self.create(key=key, value=value, updated_by_user_id=user_id)
