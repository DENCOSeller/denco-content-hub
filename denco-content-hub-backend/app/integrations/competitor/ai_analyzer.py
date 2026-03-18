from __future__ import annotations

import json

import structlog
from anthropic import Anthropic

from app.config import settings

logger = structlog.get_logger()

MAX_TEXT_LENGTH = 50000

COMPETITOR_ANALYSIS_PROMPT = """\
Ты — аналитик контент-маркетинга. Проанализируй пост конкурента и верни результат строго в JSON.

Платформа: {platform}
Тип контента: {content_type}

Данные поста:
- Заголовок: {title}
- Описание/текст: {description}
- Просмотры: {views}
- Лайки: {likes}
- Комментарии: {comments}
- ER: {er_score}

Верни JSON со следующими полями:

1. "summary" (string) — краткое резюме поста в 2-3 предложениях.

2. "hooks" (array) — цепляющие приёмы, использованные в посте. Каждый элемент:
   {{"hook": "цепляющая фраза/приём", "explanation": "почему это работает"}}

3. "key_points" (array of strings) — ключевые тезисы/идеи поста.

4. "topics" (array of strings) — темы/категории поста (маркетинг, продажи, личный бренд и т.д.).

5. "tone" (string) — тональность: одно из "educational", "entertaining", "inspirational", \
"promotional", "provocative", "storytelling", "analytical", "conversational".

6. "content_structure" (object) — структура контента:
   {{"format": "тип формата (listicle/story/how-to/case-study/opinion/news)", \
"has_cta": true/false, "cta_type": "тип CTA если есть", \
"opening_style": "как начинается пост"}}

7. "content_ideas" (array) — идеи контента, вдохновлённые этим постом. Каждый элемент:
   {{"idea": "идея для нашего контента", "angle": "под каким углом подать"}}

8. "quality_score" (float 0-10) — оценка качества контента по шкале от 0 до 10.

Верни ТОЛЬКО валидный JSON без markdown-обёртки, без пояснений.\
"""


def analyze_competitor_post(
    *,
    platform: str,
    content_type: str | None,
    title: str | None,
    description: str | None,
    views: int | None,
    likes: int | None,
    comments: int | None,
    er_score: float | None,
) -> dict:
    """Анализирует пост конкурента через Claude API. Возвращает dict с результатами."""
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY не настроен")

    text = (description or "")[:MAX_TEXT_LENGTH]
    if not text and not title:
        raise ValueError("Нет текста для анализа: пустые title и description")

    prompt = COMPETITOR_ANALYSIS_PROMPT.format(
        platform=platform or "unknown",
        content_type=content_type or "unknown",
        title=title or "—",
        description=text or "—",
        views=views or "—",
        likes=likes or "—",
        comments=comments or "—",
        er_score=f"{er_score:.2f}" if er_score else "—",
    )

    client = Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.create(
        model=settings.ai_model,
        max_tokens=4096,
        timeout=120.0,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text

    # Убираем markdown-обёртку если Claude добавил
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        cleaned = "\n".join(lines[1:-1]).strip()

    try:
        result: dict = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.error(
            "Claude returned invalid JSON",
            raw_response=cleaned[:500],
            error=str(exc),
        )
        raise ValueError(f"Claude API вернул невалидный JSON: {exc}") from exc

    logger.info(
        "Competitor post analyzed via Claude",
        platform=platform,
        title=(title or "")[:80],
        quality_score=result.get("quality_score"),
    )
    return result
