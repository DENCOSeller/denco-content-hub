from __future__ import annotations

import re

import structlog
from anthropic import Anthropic

logger = structlog.get_logger()

TEXT_PROMPT = (
    "Ты редактор транскрипции. Исправь ошибки распознавания речи, "
    "пунктуацию и заглавные буквы в тексте на русском языке. "
    "Исправляй слова если они явно неправильно распознаны. "
    "Сохраняй смысл и стиль речи. "
    "Верни только исправленный текст без пояснений."
)

SEGMENTS_PROMPT = (
    "Ты редактор транскрипции. Тебе даны пронумерованные сегменты "
    "автоматической расшифровки речи на русском языке.\n\n"
    "Задачи:\n"
    "1. Исправь ошибки распознавания речи, пунктуацию и заглавные буквы.\n"
    "2. Объединяй короткие сегменты, которые являются частью одного "
    "предложения. Каждый итоговый сегмент должен заканчиваться на точку, "
    "вопросительный или восклицательный знак — не на середине предложения.\n"
    "3. Сохраняй смысл и стиль речи.\n\n"
    "Верни результат в том же формате: нумерованные строки «1: текст». "
    "Без пояснений, только исправленные сегменты."
)

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 4096

_LINE_RE = re.compile(r"^(\d+):\s*(.+)$")


class TranscriptionNormalizer:
    """Normalizes Whisper transcription text via Claude API."""

    def __init__(self, api_key: str) -> None:
        self._client = Anthropic(api_key=api_key)

    def _call_claude(self, prompt: str, text: str) -> str | None:
        """Send text to Claude for normalization. Returns None on failure."""
        if not text or not text.strip():
            return text
        try:
            response = self._client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                messages=[{"role": "user", "content": f"{prompt}\n\n{text}"}],
            )
            return response.content[0].text
        except Exception:
            logger.warning(
                "Claude normalization failed, using original",
                text_length=len(text),
                exc_info=True,
            )
            return None

    def normalize_text(self, text: str) -> str:
        """Normalize full transcription text."""
        result = self._call_claude(TEXT_PROMPT, text)
        return result if result is not None else text

    def normalize_segments(self, segments: list[dict]) -> list[dict]:
        """Normalize all segments in one Claude call with full context."""
        if not segments:
            return segments

        # Build numbered input
        numbered = "\n".join(f"{i + 1}: {seg.get('text', '')}" for i, seg in enumerate(segments))

        result = self._call_claude(SEGMENTS_PROMPT, numbered)
        if result is None:
            return segments

        # Parse Claude response back into segments
        return self._parse_response(result, segments)

    def _parse_response(self, response: str, original_segments: list[dict]) -> list[dict]:
        """Parse numbered response and map back to segment timecodes."""
        lines: list[str] = []
        for line in response.strip().splitlines():
            match = _LINE_RE.match(line.strip())
            if match:
                lines.append(match.group(2).strip())

        if not lines:
            logger.warning("Could not parse Claude segments response, using original")
            return original_segments

        # Distribute original timecodes across merged segments.
        # Claude may return fewer segments (merged), so we split
        # original timecodes evenly across the new segments.
        chunk_size = max(1, len(original_segments) // len(lines))
        normalized: list[dict] = []

        for i, text in enumerate(lines):
            src_idx = min(i * chunk_size, len(original_segments) - 1)
            last_idx = min((i + 1) * chunk_size - 1, len(original_segments) - 1)
            normalized.append(
                {
                    "start": original_segments[src_idx]["start"],
                    "end": original_segments[last_idx]["end"],
                    "text": text,
                }
            )

        return normalized
