# ruff: noqa: RUF001
import json

import structlog
from anthropic import Anthropic

from app.config import settings
from app.models.content_analysis import ContentAnalysis
from app.models.content_item import ContentItem, ContentStatus, SourceType
from app.models.transcription import Transcription
from app.worker.celery_app import celery_app
from app.worker.db import SyncSessionLocal

logger = structlog.get_logger()

MAX_TEXT_LENGTH = 100000

ANALYSIS_PROMPT = """\
Ты — аналитик контента и помощник контент-продюсера. Проанализируй текст и верни результат строго в JSON формате.

Тип источника: {source_type}

Верни JSON с 7 секциями:

1. "summary" (string) — краткое резюме контента в 2-3 предложениях.

2. "theses" (array) — ключевые тезисы контента. Каждый элемент:
   {{"title": "краткий заголовок тезиса", "description": "развёрнутое описание"}}

3. "hooks" (array) — цепляющие фразы/идеи из контента, которые можно использовать для привлечения аудитории. Каждый элемент:
   {{"hook": "цепляющая фраза", "explanation": "почему это работает как hook"}}

4. "storyboard" (array) — структура контента.
   {storyboard_instruction}

5. "content_ideas" (array) — список идей контента, которые можно создать на основе этого материала. \
Думай как контент-продюсер: какие посты, видео, сторис, рилсы, подкасты можно сделать? Каждый элемент:
   {{"title": "название идеи контента", \
"description": "описание: формат, целевая платформа, ключевой посыл, примерный план"}}

6. "audience_insights" (string) — подробный анализ аудитории: \
на какую аудиторию рассчитан контент, какие боли и потребности закрывает, \
какой уровень знаний предполагает у зрителя/читателя, \
какие сегменты аудитории будут наиболее вовлечены и почему.

7. "production_notes" (string) — заметки по продакшену для контент-продюсера: \
формат подачи материала, темп повествования, монтажные приёмы (если видео), \
что работает хорошо в этом контенте, что можно улучшить, \
рекомендации по визуальному оформлению и структуре.

Верни ТОЛЬКО валидный JSON без markdown-обёртки, без пояснений.\
"""

STORYBOARD_VIDEO = """\
Для видео: каждый элемент = {{"time_start": "MM:SS", "time_end": "MM:SS", "topic": "тема блока", "purpose": "цель блока"}}\
"""

STORYBOARD_TEXT = """\
Для текста: каждый элемент = {{"block_number": 1, "topic": "тема блока", "purpose": "цель блока"}}\
"""


def _get_source_label(source_type: SourceType) -> str:
    labels = {
        SourceType.YOUTUBE_VIDEO: "YouTube видео",
        SourceType.PDF_FILE: "PDF документ",
        SourceType.WEB_PAGE: "Веб-страница",
        SourceType.MANUAL_TEXT: "Текст",
    }
    return labels.get(source_type, "Контент")


@celery_app.task(
    bind=True,
    name="analyze_content",
    max_retries=1,
    default_retry_delay=60,
    acks_late=True,
    time_limit=300,
    soft_time_limit=280,
)
def analyze_content_task(self, content_item_id: int) -> dict:
    """Analyze content via Claude API and save summary, theses, hooks, storyboard."""
    db = SyncSessionLocal()
    try:
        item = (
            db.query(ContentItem)
            .filter(
                ContentItem.id == content_item_id,
                ContentItem.deleted_at.is_(None),
            )
            .first()
        )
        if not item:
            logger.warning("Content item not found or deleted", content_item_id=content_item_id)
            return {"status": "skipped", "message": f"ContentItem {content_item_id} not found"}

        # Get text: for YouTube — from transcription, for others — from extracted_text
        if item.source_type == SourceType.YOUTUBE_VIDEO:
            transcription = db.query(Transcription).filter(Transcription.content_item_id == content_item_id).first()
            text = transcription.text if transcription else None
        else:
            text = item.extracted_text

        if not text or not text.strip():
            logger.warning("No text to analyze", content_item_id=content_item_id)
            # Mark existing analysis as failed so it doesn't hang in "pending"
            analysis = db.query(ContentAnalysis).filter(ContentAnalysis.content_item_id == content_item_id).first()
            if analysis:
                analysis.status = "failed"
                analysis.error_message = "Нет текста для анализа"
                db.commit()
            return {"status": "skipped", "message": "No text available for analysis"}

        # Create or update ContentAnalysis record
        analysis = db.query(ContentAnalysis).filter(ContentAnalysis.content_item_id == content_item_id).first()
        if not analysis:
            analysis = ContentAnalysis(content_item_id=content_item_id)
            db.add(analysis)

        analysis.status = "processing"
        analysis.error_message = None
        analysis.celery_task_id = self.request.id
        item.processing_step = "Анализ контента..."
        db.commit()

        # Truncate text if too long
        truncated_text = text[:MAX_TEXT_LENGTH]

        # Build prompt
        is_video = item.source_type == SourceType.YOUTUBE_VIDEO
        storyboard_instruction = STORYBOARD_VIDEO if is_video else STORYBOARD_TEXT
        source_label = _get_source_label(item.source_type)

        prompt = ANALYSIS_PROMPT.format(
            source_type=source_label,
            storyboard_instruction=storyboard_instruction,
        )

        # Call Claude API
        client = Anthropic(api_key=settings.anthropic_api_key)
        response = client.messages.create(
            model=settings.ai_model,
            max_tokens=8192,
            messages=[{"role": "user", "content": f"{prompt}\n\n{truncated_text}"}],
        )
        raw_response = response.content[0].text

        # Parse JSON from response
        # Strip markdown code block wrapper if present
        cleaned = raw_response.strip()
        if cleaned.startswith("```"):
            # Remove first line (```json) and last line (```)
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1]).strip()

        result = json.loads(cleaned)

        # Save results
        analysis.summary = result.get("summary")
        analysis.theses = result.get("theses")
        analysis.hooks = result.get("hooks")
        analysis.storyboard = result.get("storyboard")
        analysis.content_ideas = result.get("content_ideas")
        analysis.audience_insights = result.get("audience_insights")
        analysis.production_notes = result.get("production_notes")
        analysis.status = "completed"
        analysis.error_message = None
        item.processing_step = None
        db.commit()

        logger.info("Content analysis completed", content_item_id=content_item_id)
        return {"status": "completed", "content_item_id": content_item_id}

    except Exception as exc:
        db.rollback()
        error_msg = str(exc)[:500]

        try:
            analysis = db.query(ContentAnalysis).filter(ContentAnalysis.content_item_id == content_item_id).first()
            if analysis:
                analysis.status = "failed"
                analysis.error_message = error_msg

            item = db.query(ContentItem).filter(ContentItem.id == content_item_id).first()
            if item:
                item.processing_step = None
            db.commit()
        except Exception:
            db.rollback()

        logger.error("Content analysis failed", content_item_id=content_item_id, error=error_msg)
        return {"status": "failed", "content_item_id": content_item_id, "error": error_msg}

    finally:
        db.close()
