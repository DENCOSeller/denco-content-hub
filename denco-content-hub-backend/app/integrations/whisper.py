from __future__ import annotations

import os
from dataclasses import dataclass

import structlog

logger = structlog.get_logger()


@dataclass(frozen=True, slots=True)
class TranscriptionResult:
    """Result of Whisper transcription."""

    text: str
    language: str
    duration_seconds: int
    segments: list[dict]


class WhisperError(Exception):
    """Raised when Whisper transcription fails."""


class WhisperTranscriber:
    """Local Whisper model wrapper with lazy loading."""

    def __init__(self, model_size: str = "small") -> None:
        self.model_size = model_size
        self._model: object = None

    def _get_model(self) -> object:
        """Lazy load model. Cached in self._model per process."""
        if self._model is None:
            import whisper

            logger.info("Loading Whisper model", model_size=self.model_size)
            self._model = whisper.load_model(self.model_size)
        return self._model

    def transcribe(self, audio_path: str) -> TranscriptionResult:
        """Transcribe audio file using local Whisper model."""
        if not os.path.exists(audio_path):
            raise WhisperError(f"Audio file not found: {audio_path}")
        if os.path.getsize(audio_path) == 0:
            raise WhisperError("Empty audio file")

        model = self._get_model()
        try:
            result = model.transcribe(audio_path, fp16=False)
        except Exception as exc:
            logger.error("Whisper transcription failed", path=audio_path, error=str(exc))
            raise WhisperError(str(exc)) from exc

        text = result.get("text", "").strip()
        language = result.get("language", "unknown")

        raw_segments = result.get("segments", [])
        duration = int(raw_segments[-1].get("end", 0)) if raw_segments else 0
        segments = [{"start": s["start"], "end": s["end"], "text": s.get("text", "").strip()} for s in raw_segments]

        logger.info(
            "Transcription completed",
            path=audio_path,
            language=language,
            duration_seconds=duration,
            text_length=len(text),
            segments_count=len(segments),
        )

        return TranscriptionResult(
            text=text,
            language=language,
            duration_seconds=duration,
            segments=segments,
        )
