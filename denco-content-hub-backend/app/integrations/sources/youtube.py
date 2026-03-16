from __future__ import annotations

import structlog

from app.integrations.sources.base import BaseSourceAdapter, SourceExtractionError
from app.integrations.youtube import YouTubeParseError, YouTubeParser

logger = structlog.get_logger()


class YouTubeAdapter(BaseSourceAdapter):
    """Adapter wrapping the existing :class:`YouTubeParser`.

    Expected *data* keys:
    - ``url`` (str) — YouTube video URL.
    - ``text`` (str, optional) — pre-existing transcription text returned by
      the transcription pipeline.  ``extract_text`` returns it as-is when
      present; otherwise it raises because this adapter does not perform
      transcription itself.
    """

    def __init__(self) -> None:
        self._parser = YouTubeParser()

    # ------------------------------------------------------------------
    # BaseSourceAdapter interface
    # ------------------------------------------------------------------

    def validate_input(self, data: dict) -> bool:
        url: str = data.get("url", "")
        if not url:
            raise SourceExtractionError("Missing 'url' in input data")
        lower = url.lower()
        if "youtube.com" not in lower and "youtu.be" not in lower:
            raise SourceExtractionError(
                f"URL does not look like a YouTube link: {url}"
            )
        return True

    def extract_metadata(self, data: dict) -> dict:
        url: str = data["url"]
        try:
            meta = self._parser.fetch_metadata(url)
        except YouTubeParseError as exc:
            raise SourceExtractionError(
                f"Failed to fetch YouTube metadata: {exc}"
            ) from exc

        return {
            "video_id": meta.video_id,
            "title": meta.title,
            "description": meta.description,
            "thumbnail_url": meta.thumbnail_url,
            "duration_seconds": meta.duration_seconds,
            "channel_name": meta.channel_name,
            "channel_url": meta.channel_url,
            "view_count": meta.view_count,
            "like_count": meta.like_count,
            "upload_date": meta.upload_date.isoformat() if meta.upload_date else None,
            "tags": meta.tags,
        }

    def extract_text(self, data: dict) -> str:
        text: str | None = data.get("text")
        if not text:
            raise SourceExtractionError(
                "YouTubeAdapter.extract_text requires pre-existing transcription "
                "text passed via data['text']. Use the transcription pipeline first."
            )
        return text

    def supports_transcription(self) -> bool:
        return True
