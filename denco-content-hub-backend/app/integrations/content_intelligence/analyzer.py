"""UnifiedAnalyzer — single Claude call for dynamic content analysis."""

from __future__ import annotations

import json

import structlog
from anthropic import Anthropic

from app.config import settings

from .config import PROMPT_VERSION, get_sections
from .schemas import IntelligenceResult

logger = structlog.get_logger()

MIN_TEXT_LENGTH = 30
MAX_TEXT_LENGTH = 50_000

ANALYSIS_PROMPT = """\
You are an expert content analyst. Analyze the provided content and return a structured JSON result.

## Context
- Source type: {source_type}
- Platform: {platform}
- Duration: {duration}
- Has timestamps: {has_timestamps}

## Content
{text}

## Required analysis sections

{sections_instructions}

## Output format
Return ONLY valid JSON (no markdown wrapping, no extra text) with the following keys \
matching the requested sections above. Omit sections that were not requested.\
"""

SECTION_PROMPTS: dict[str, str] = {
    "summary": ('"summary" (string): A concise 2-3 sentence summary capturing the core message and value.'),
    "key_points": (
        '"key_points" (array of objects): Key takeaways. '
        'Each: {"point": "the key point", "importance": "why it matters"}.'
    ),
    "hooks": (
        '"hooks" (array of objects): Attention-grabbing hooks used in the content. '
        'Each: {"hook": "the hook phrase/technique", "explanation": "why it works"}.'
    ),
    "topics": (
        '"topics" (array of objects): Topic tags for categorization. '
        'Each: {"name": "topic name", "category": "broader category or null"}.'
    ),
    "tone": (
        '"tone" (string): The dominant tone — one of: "educational", "entertaining", '
        '"inspirational", "promotional", "provocative", "storytelling", "analytical", "conversational".'
    ),
    "quality_score": (
        '"quality_score" (float, 0-10): Overall content quality score considering '
        "originality, depth, structure, engagement potential, and production value."
    ),
    "content_ideas": (
        '"content_ideas" (array of objects): Content ideas inspired by this material. '
        'Each: {"idea": "content idea description", "angle": "unique angle to approach it"}.'
    ),
    "content_structure": (
        '"content_structure" (object): Structural analysis. '
        '{"format": "listicle|story|how-to|case-study|opinion|news|tutorial|review", '
        '"has_cta": true/false, "cta_type": "type of CTA if present or null", '
        '"opening_style": "how the content opens"}.'
    ),
    "storyboard": (
        '"storyboard" (array of objects): Video storyboard breakdown by segments. '
        'Each: {"topic": "segment topic", "purpose": "why this segment exists", '
        '"time_start": "HH:MM:SS or null", "time_end": "HH:MM:SS or null", '
        '"block_number": sequential integer}.'
    ),
    "audience_insights": (
        '"audience_insights" (array of objects): Insights about the target audience. '
        'Each: {"insight": "audience observation", "recommendation": "actionable suggestion or null"}.'
    ),
    "production_notes": (
        '"production_notes" (array of objects): Notes on production quality and techniques. '
        'Each: {"note": "observation about production", "category": "editing|audio|visual|pacing|null"}.'
    ),
}


class UnifiedAnalyzer:
    """Analyzes content via a single Claude API call with dynamic sections."""

    def __init__(self) -> None:
        if not settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY не настроен")
        self._client = Anthropic(api_key=settings.anthropic_api_key)

    def analyze(
        self,
        text: str,
        metadata: dict | None = None,
        sections: list[str] | None = None,
    ) -> IntelligenceResult:
        """Run analysis on text with requested sections.

        Args:
            text: Content text to analyze.
            metadata: Optional dict with source_type, platform, duration, has_timestamps.
            sections: Explicit list of sections. If None, derived from metadata.source_type.

        Returns:
            IntelligenceResult with populated sections.
            If text is too short, returns empty result (caller sets status='skipped').

        """
        meta = metadata or {}
        source_type = meta.get("source_type", "competitor_post")

        if len(text.strip()) < MIN_TEXT_LENGTH:
            logger.info(
                "Text too short for analysis, skipping",
                length=len(text.strip()),
                source_type=source_type,
            )
            return IntelligenceResult()

        if sections is None:
            is_video = bool(meta.get("duration"))
            sections = get_sections(source_type, is_video=is_video)

        truncated = text[:MAX_TEXT_LENGTH]

        sections_instructions = "\n".join(
            f"{i + 1}. {SECTION_PROMPTS[s]}" for i, s in enumerate(sections) if s in SECTION_PROMPTS
        )

        prompt = ANALYSIS_PROMPT.format(
            source_type=source_type,
            platform=meta.get("platform", "unknown"),
            duration=meta.get("duration", "N/A"),
            has_timestamps=meta.get("has_timestamps", False),
            text=truncated,
            sections_instructions=sections_instructions,
        )

        response = self._client.messages.create(
            model=settings.ai_model,
            max_tokens=4096,
            timeout=120.0,
            messages=[{"role": "user", "content": prompt}],
        )
        if not response.content or not hasattr(response.content[0], "text"):
            logger.error(
                "Claude returned empty response",
                source_type=source_type,
            )
            raise ValueError("Claude API вернул пустой ответ")
        raw = response.content[0].text

        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1]).strip()

        try:
            data: dict = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            logger.error(
                "Claude returned invalid JSON",
                raw_response=cleaned[:500],
                error=str(exc),
                source_type=source_type,
            )
            raise ValueError(f"Claude API вернул невалидный JSON: {exc}") from exc

        result = IntelligenceResult.model_validate(data)

        logger.info(
            "Content analyzed via Claude",
            source_type=source_type,
            sections=sections,
            quality_score=result.quality_score,
            model=settings.ai_model,
            prompt_version=PROMPT_VERSION,
        )
        return result
