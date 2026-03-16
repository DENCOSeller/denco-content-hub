from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from datetime import date
from typing import ClassVar
from urllib.parse import parse_qs, urlparse

import structlog
import yt_dlp

logger = structlog.get_logger()

# Regex covers: v=, /v/, youtu.be/, /shorts/, /embed/, /live/
_VIDEO_ID_RE = re.compile(r"(?:v=|/v/|youtu\.be/|/shorts/|/embed/|/live/)([a-zA-Z0-9_-]{11})")


@dataclass(frozen=True, slots=True)
class ParsedMetadata:
    """Metadata extracted from YouTube video via yt-dlp."""

    video_id: str
    title: str
    description: str | None = None
    thumbnail_url: str | None = None
    duration_seconds: int | None = None
    channel_name: str | None = None
    channel_url: str | None = None
    view_count: int | None = None
    like_count: int | None = None
    upload_date: date | None = None
    tags: list[str] = field(default_factory=list)


class YouTubeParseError(Exception):
    """Raised when yt-dlp fails to extract metadata."""


class YouTubeDownloadError(Exception):
    """Raised when yt-dlp fails to download audio."""


@dataclass(frozen=True, slots=True)
class AudioDownloadResult:
    """Result of downloading and converting audio to WAV."""

    file_path: str
    file_size_bytes: int
    duration_seconds: int


class YouTubeParser:
    """YouTube metadata parser via yt-dlp. No video download."""

    YDL_OPTS: ClassVar[dict[str, object]] = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
        "skip_download": True,
        "no_check_certificates": False,
        "socket_timeout": 30,
        "noplaylist": True,
        "playlist_items": "1",
        "cachedir": False,
        "no_color": True,
    }

    @staticmethod
    def extract_video_id(url: str) -> str | None:
        """Extract video_id from URL without network requests.

        Supports: watch?v=, /v/, youtu.be/, /shorts/, /embed/, /live/
        Also handles v= as non-first query parameter.
        """
        # Try query parameter first (handles ?feature=share&v=ID)
        parsed = urlparse(url)
        v_param = parse_qs(parsed.query).get("v")
        if v_param and re.fullmatch(r"[a-zA-Z0-9_-]{11}", v_param[0]):
            return v_param[0]

        # Fallback to path-based regex
        match = _VIDEO_ID_RE.search(url)
        return match.group(1) if match else None

    def fetch_metadata(self, url: str) -> ParsedMetadata:
        """Fetch video metadata via yt-dlp. Synchronous — run in Celery only."""
        try:
            with yt_dlp.YoutubeDL(self.YDL_OPTS) as ydl:
                info = ydl.extract_info(url, download=False)
        except yt_dlp.utils.DownloadError as exc:
            logger.error("yt-dlp download error", url=url, error=str(exc))
            raise YouTubeParseError(str(exc)) from exc

        if info is None:
            raise YouTubeParseError("yt-dlp returned no data")

        video_id = info.get("id", "")
        if not video_id:
            raise YouTubeParseError("yt-dlp returned empty video_id")

        upload_date = self._parse_upload_date(info.get("upload_date"))

        return ParsedMetadata(
            video_id=video_id,
            title=info.get("title", ""),
            description=info.get("description"),
            thumbnail_url=info.get("thumbnail"),
            duration_seconds=info.get("duration"),
            channel_name=info.get("uploader") or info.get("channel"),
            channel_url=info.get("uploader_url") or info.get("channel_url"),
            view_count=info.get("view_count"),
            like_count=info.get("like_count"),
            upload_date=upload_date,
            tags=info.get("tags") or [],
        )

    def download_audio(self, url: str, output_path: str) -> AudioDownloadResult:
        """Download audio from YouTube video as WAV 16kHz mono.

        Args:
            url: YouTube video URL.
            output_path: Output file path WITHOUT extension (yt-dlp adds .wav).

        Returns:
            AudioDownloadResult with file path, size, and duration.
        """
        ydl_opts: dict[str, object] = {
            "format": "bestaudio/best",
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "wav",
                },
            ],
            "postprocessor_args": {
                "FFmpegExtractAudio": ["-ar", "16000", "-ac", "1"],
            },
            "outtmpl": output_path,
            "quiet": True,
            "no_warnings": True,
            "socket_timeout": 60,
            "noplaylist": True,
            "cachedir": False,
            "no_color": True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
        except yt_dlp.utils.DownloadError as exc:
            logger.error("yt-dlp audio download error", url=url, error=str(exc))
            raise YouTubeDownloadError(str(exc)) from exc

        if info is None:
            raise YouTubeDownloadError("yt-dlp returned no data")

        wav_path = output_path + ".wav"
        if not os.path.exists(wav_path) or os.path.getsize(wav_path) == 0:
            raise YouTubeDownloadError("No audio stream available")

        duration = info.get("duration") or 0

        return AudioDownloadResult(
            file_path=wav_path,
            file_size_bytes=os.path.getsize(wav_path),
            duration_seconds=int(duration),
        )

    @staticmethod
    def _parse_upload_date(raw: str | None) -> date | None:
        """Parse yt-dlp upload_date format (YYYYMMDD)."""
        if not raw or len(raw) < 8:
            return None
        try:
            return date(int(raw[:4]), int(raw[4:6]), int(raw[6:8]))
        except (ValueError, IndexError):
            return None
