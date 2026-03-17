"""Сервис AI генерации контента для библиотеки."""

from __future__ import annotations

import json
from typing import Any

import anthropic
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.knowledge import KgNodeTypeDef, KnowledgeNode
from app.models.library_item import LibraryItem
from app.models.workspace import Workspace
from app.repositories.library_repository import LibraryItemRepository

logger = structlog.get_logger()

_MODEL = "claude-sonnet-4-20250514"
_MAX_TOKENS = 4096

# Маппинг content_type → тип контента для промпта и JSON schema
_CONTENT_SCHEMAS: dict[str, dict[str, Any]] = {
    "shorts": {
        "label": "короткое вертикальное видео (Shorts)",
        "schema": {
            "hook": "string — цепляющий хук первых 3 секунд",
            "body": "string — основной сценарий",
            "cta": "string — призыв к действию",
            "storyboard": ["string — описание каждой сцены"],
            "hashtags": ["string"],
            "duration_hint": "string — рекомендуемая длительность",
        },
    },
    "reels": {
        "label": "короткое вертикальное видео (Reels)",
        "schema": {
            "hook": "string — цепляющий хук первых 3 секунд",
            "body": "string — основной сценарий",
            "cta": "string — призыв к действию",
            "storyboard": ["string — описание каждой сцены"],
            "hashtags": ["string"],
            "duration_hint": "string — рекомендуемая длительность",
        },
    },
    "clip": {
        "label": "короткий клип",
        "schema": {
            "hook": "string — цепляющий хук первых 3 секунд",
            "body": "string — основной сценарий",
            "cta": "string — призыв к действию",
            "storyboard": ["string — описание каждой сцены"],
            "hashtags": ["string"],
            "duration_hint": "string — рекомендуемая длительность",
        },
    },
    "post": {
        "label": "пост",
        "schema": {
            "title": "string — заголовок поста",
            "body": "string — текст поста",
            "cta": "string — призыв к действию",
            "hashtags": ["string"],
            "visual_hint": "string — описание визуала для поста",
        },
    },
    "carousel": {
        "label": "карусель",
        "schema": {
            "slides": [
                {
                    "title": "string — заголовок слайда",
                    "body": "string — текст слайда",
                    "visual_hint": "string — описание визуала слайда",
                }
            ],
            "caption": "string — подпись к карусели",
            "hashtags": ["string"],
        },
    },
    "long_video": {
        "label": "длинное видео",
        "schema": {
            "title": "string — заголовок видео",
            "hook": "string — вступительный хук",
            "chapters": [
                {
                    "time": "string — таймкод",
                    "title": "string — название главы",
                    "content": "string — содержание главы",
                }
            ],
            "cta": "string — призыв к действию",
            "description": "string — описание видео",
            "tags": ["string"],
        },
    },
    "article": {
        "label": "статья",
        "schema": {
            "title": "string — заголовок статьи",
            "body": "string — полный текст статьи",
            "cta": "string — призыв к действию",
        },
    },
}

_CATEGORY_LABELS: dict[str, str] = {
    "reach": "Охват — максимальное распространение, виральность",
    "expert": "Экспертный — демонстрация экспертизы и знаний",
    "selling": "Продающий — конверсия в продажу",
    "warming": "Прогревающий — вовлечение и прогрев аудитории",
}


class LibraryGenerationService:
    """Сервис генерации контента через Claude API."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = LibraryItemRepository(db)

    async def generate(self, workspace_id: int, item_id: int) -> LibraryItem:
        """Генерирует контент для library item через Claude API."""
        item = await self.repo.get_by_id_in_workspace(workspace_id, item_id)

        # Получить company_id через workspace
        ws_result = await self.db.execute(select(Workspace.company_id).where(Workspace.id == workspace_id))
        company_id = ws_result.scalar_one()

        # Собрать контекст из графа знаний
        context_parts = await self._collect_knowledge_context(
            workspace_id=workspace_id,
            company_id=company_id,
            platform=item.platform,
            content_type=item.content_type,
            hunt_level=item.hunt_level,
        )

        # Сформировать промпт
        prompt = self._build_prompt(item, context_parts)

        logger.info(
            "Generating library content",
            item_id=item_id,
            workspace_id=workspace_id,
            content_type=item.content_type,
            platform=item.platform,
        )

        # Вызвать Claude API
        generated = await self._call_claude(prompt)

        # Обновить item
        item.generated_content = generated
        item.generation_prompt = prompt
        await self.db.flush()
        await self.db.refresh(item)
        await self.db.commit()

        logger.info(
            "Library content generated",
            item_id=item_id,
            has_structured=("raw_text" not in generated),
        )
        return item

    async def _collect_knowledge_context(
        self,
        workspace_id: int,
        company_id: int,
        platform: str,
        content_type: str,
        hunt_level: int,
    ) -> list[str]:
        """Собирает правила из графа знаний для промпта."""
        parts: list[str] = []

        node_queries: list[tuple[str, str, str | None, bool]] = [
            ("Платформа", "platform", platform, False),
            ("Формат контента", "content_format", content_type, False),
            ("Уровень охоты", "hunt_level", str(hunt_level), False),
            ("Сегменты аудитории", "audience_segment", None, True),
            ("Целевая аудитория", "target_audience", None, True),
        ]

        for label, type_slug, search_hint, collect_all in node_queries:
            nodes = await self._find_nodes(workspace_id, company_id, type_slug, search_hint, collect_all)
            for node in nodes:
                if node.content_text:
                    parts.append(f"[{label}: {node.title}]\n{node.content_text}")

        return parts

    async def _find_nodes(
        self,
        workspace_id: int,
        company_id: int,
        type_slug: str,
        search_hint: str | None,
        collect_all: bool,
    ) -> list[KnowledgeNode]:
        """Ищет узлы графа по slug типа — сначала в workspace, потом в company."""
        base = (
            select(KnowledgeNode)
            .join(KgNodeTypeDef, KnowledgeNode.node_type_def_id == KgNodeTypeDef.id)
            .where(KnowledgeNode.deleted_at.is_(None))
            .where(KgNodeTypeDef.slug == type_slug)
        )

        # Ищем сначала в workspace, потом в company
        for scope_filter in [
            KnowledgeNode.workspace_id == workspace_id,
            KnowledgeNode.company_id == company_id,
        ]:
            query = base.where(scope_filter)
            result = await self.db.execute(query)
            nodes = list(result.scalars().all())

            if not nodes:
                continue

            if collect_all:
                return nodes

            # Для единичных узлов — ищем по title
            if search_hint:
                matched = [n for n in nodes if search_hint.lower() in n.title.lower()]
                if matched:
                    return matched[:1]

            # Если hint не совпал — вернём первый
            return nodes[:1]

        return []

    def _build_prompt(self, item: LibraryItem, context_parts: list[str]) -> str:
        """Формирует промпт для Claude."""
        schema_info = _CONTENT_SCHEMAS.get(item.content_type)
        content_label = schema_info["label"] if schema_info else item.content_type
        json_schema = json.dumps(
            schema_info["schema"] if schema_info else {},
            ensure_ascii=False,
            indent=2,
        )

        category_label = _CATEGORY_LABELS.get(item.category, item.category)

        sections: list[str] = []

        sections.append(
            f"Ты — профессиональный копирайтер и контент-стратег. Создай {content_label} для платформы {item.platform}."
        )

        sections.append(f"Категория контента: {category_label}\nУровень лестницы Ханта: {item.hunt_level} из 5")

        if context_parts:
            sections.append("Правила и контекст из базы знаний компании:\n\n" + "\n\n".join(context_parts))

        if item.source_text:
            sections.append(f"Исходный материал для переработки:\n\n{item.source_text}")

        sections.append(
            f"Верни ответ СТРОГО в формате JSON (без markdown-обёртки, без ```json).\nСтруктура JSON:\n{json_schema}"
        )

        return "\n\n---\n\n".join(sections)

    async def _call_claude(self, prompt: str) -> dict[str, Any]:
        """Вызывает Claude API и парсит JSON ответ."""
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

        try:
            response = await client.messages.create(
                model=_MODEL,
                max_tokens=_MAX_TOKENS,
                messages=[{"role": "user", "content": prompt}],
            )
        except anthropic.APIError as exc:
            logger.error("Claude API error", error=str(exc))
            raise

        raw_text = response.content[0].text if response.content else ""

        # Попробовать распарсить JSON
        try:
            # Убрать возможную markdown-обёртку
            clean = raw_text.strip()
            if clean.startswith("```"):
                # Убрать ```json и ```
                first_newline = clean.index("\n")
                last_backticks = clean.rindex("```")
                clean = clean[first_newline + 1 : last_backticks].strip()

            return json.loads(clean)
        except (json.JSONDecodeError, ValueError):
            logger.warning(
                "Claude returned non-JSON response, saving as raw_text",
                response_length=len(raw_text),
            )
            return {"raw_text": raw_text}
