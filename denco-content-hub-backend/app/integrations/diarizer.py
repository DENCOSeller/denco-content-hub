from __future__ import annotations

import structlog

logger = structlog.get_logger()


class DiarizationError(Exception):
    """Raised when speaker diarization fails."""


class SpeakerDiarizer:
    """Speaker diarization via pyannote.audio pipeline."""

    def __init__(self, token: str) -> None:
        self._token = token
        self._pipeline: object = None

    def _get_pipeline(self) -> object:
        """Lazy load pyannote pipeline. Cached per instance."""
        if self._pipeline is None:
            from pyannote.audio import Pipeline

            logger.info("Loading pyannote diarization pipeline")
            self._pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                token=self._token,
            )
        return self._pipeline

    def diarize(self, audio_path: str, segments: list[dict]) -> list[dict]:
        """Assign speaker labels to each segment.

        For each segment, finds the dominant speaker in [start, end]
        and adds ``speaker`` field ("Спикер 1", "Спикер 2", …).
        """
        if not segments:
            return segments

        pipeline = self._get_pipeline()
        try:
            result = pipeline(audio_path)
        except Exception as exc:
            logger.error("Diarization failed", path=audio_path, error=str(exc))
            raise DiarizationError(str(exc)) from exc

        # pyannote 4.x returns DiarizeOutput dataclass; extract Annotation
        annotation = getattr(result, "speaker_diarization", result)

        # Build speaker label mapping: SPEAKER_00 → "Спикер 1"
        raw_labels = sorted(annotation.labels())
        label_map: dict[str, str] = {label: f"Спикер {i + 1}" for i, label in enumerate(raw_labels)}

        logger.info(
            "Diarization completed",
            speakers_count=len(raw_labels),
            segments_count=len(segments),
        )

        return [{**seg, "speaker": self._find_speaker(annotation, seg, label_map)} for seg in segments]

    def _find_speaker(
        self,
        annotation: object,
        segment: dict,
        label_map: dict[str, str],
    ) -> str | None:
        """Find dominant speaker for a segment time range."""
        from pyannote.core import Segment

        seg_interval = Segment(segment["start"], segment["end"])
        crop = annotation.crop(seg_interval)

        # Count duration per speaker in this interval
        durations: dict[str, float] = {}
        for turn, _, speaker in crop.itertracks(yield_label=True):
            overlap_start = max(turn.start, segment["start"])
            overlap_end = min(turn.end, segment["end"])
            if overlap_end > overlap_start:
                durations[speaker] = durations.get(speaker, 0.0) + (overlap_end - overlap_start)

        if not durations:
            return None

        dominant = max(durations, key=durations.get)  # type: ignore[arg-type]
        return label_map.get(dominant)
