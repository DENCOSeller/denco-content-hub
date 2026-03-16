"""Tests for YouTubeParser.download_audio integration."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.integrations.youtube import AudioDownloadResult, YouTubeDownloadError, YouTubeParser


class TestDownloadAudio:
    @pytest.mark.asyncio
    async def test_download_audio_success(self, tmp_path: object) -> None:
        """Mock yt-dlp → AudioDownloadResult with correct fields."""
        output_path = str(tmp_path / "audio")  # type: ignore[operator]
        wav_path = output_path + ".wav"

        # Create a fake WAV file that yt-dlp would produce
        with open(wav_path, "wb") as f:
            f.write(b"\x00" * 1024)

        mock_info = {"duration": 300}

        with patch("app.integrations.youtube.yt_dlp.YoutubeDL") as mock_ydl_cls:
            mock_ydl = MagicMock()
            mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
            mock_ydl.__exit__ = MagicMock(return_value=False)
            mock_ydl.extract_info.return_value = mock_info
            mock_ydl_cls.return_value = mock_ydl

            parser = YouTubeParser()
            result = parser.download_audio("https://youtube.com/watch?v=test123test", output_path)

        assert isinstance(result, AudioDownloadResult)
        assert result.file_path == wav_path
        assert result.file_size_bytes == 1024
        assert result.duration_seconds == 300

    @pytest.mark.asyncio
    async def test_download_audio_no_audio_stream(self, tmp_path: object) -> None:
        """Missing WAV file after download → YouTubeDownloadError."""
        output_path = str(tmp_path / "audio")  # type: ignore[operator]

        mock_info = {"duration": 100}

        with patch("app.integrations.youtube.yt_dlp.YoutubeDL") as mock_ydl_cls:
            mock_ydl = MagicMock()
            mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
            mock_ydl.__exit__ = MagicMock(return_value=False)
            mock_ydl.extract_info.return_value = mock_info
            mock_ydl_cls.return_value = mock_ydl

            parser = YouTubeParser()
            with pytest.raises(YouTubeDownloadError, match="No audio stream available"):
                parser.download_audio("https://youtube.com/watch?v=test123test", output_path)

    @pytest.mark.asyncio
    async def test_download_audio_ytdlp_error(self, tmp_path: object) -> None:
        """yt-dlp raises DownloadError → YouTubeDownloadError."""
        import yt_dlp

        output_path = str(tmp_path / "audio")  # type: ignore[operator]

        with patch("app.integrations.youtube.yt_dlp.YoutubeDL") as mock_ydl_cls:
            mock_ydl = MagicMock()
            mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
            mock_ydl.__exit__ = MagicMock(return_value=False)
            mock_ydl.extract_info.side_effect = yt_dlp.utils.DownloadError("Network error")
            mock_ydl_cls.return_value = mock_ydl

            parser = YouTubeParser()
            with pytest.raises(YouTubeDownloadError):
                parser.download_audio("https://youtube.com/watch?v=test123test", output_path)
