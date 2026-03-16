"""Tests for pipeline Celery tasks (parse_metadata, download_audio, transcribe_content)."""

from __future__ import annotations

import sys
from unittest.mock import MagicMock, patch

from app.integrations.whisper import TranscriptionResult
from app.integrations.youtube import AudioDownloadResult, ParsedMetadata, YouTubeParser
from app.models.content_item import ContentStatus
from app.models.transcription import TranscriptionStatus

# ---------------------------------------------------------------------------
# parse_metadata_task
# ---------------------------------------------------------------------------


class TestParseMetadataTask:
    @patch.object(YouTubeParser, "fetch_metadata")
    @patch("app.worker.tasks.parse_metadata.SyncSessionLocal")
    def test_dispatches_download(self, mock_session_cls, mock_fetch):
        """After successful parse, status=DOWNLOADING and download_audio.delay called."""
        from app.worker.tasks.parse_metadata import parse_metadata_task

        mock_fetch.return_value = ParsedMetadata(
            video_id="abc12345678",
            title="Test Video",
            description="desc",
            duration_seconds=120,
        )

        mock_db = MagicMock()
        mock_item = MagicMock()
        mock_item.url = "https://youtube.com/watch?v=abc12345678"
        mock_item.id = 1
        mock_db.query.return_value.filter.return_value.first.return_value = mock_item
        mock_session_cls.return_value = mock_db

        task = parse_metadata_task
        task.request.retries = 0

        # Mock the lazily-imported download_audio_task
        mock_download_mod = MagicMock()
        with patch.dict(sys.modules, {"app.worker.tasks.download_audio": mock_download_mod}):
            result = task(1)

        assert result["status"] == "downloading"
        assert mock_item.status == ContentStatus.DOWNLOADING
        mock_download_mod.download_audio_task.delay.assert_called_once_with(1)

    @patch("app.worker.tasks.parse_metadata.SyncSessionLocal")
    @patch.object(YouTubeParser, "fetch_metadata")
    def test_skips_long_video(self, mock_fetch, mock_session_cls):
        """Videos exceeding duration limit → COMPLETED, no download dispatched."""
        from app.worker.tasks.parse_metadata import parse_metadata_task

        mock_fetch.return_value = ParsedMetadata(
            video_id="abc12345678",
            title="Long Video",
            duration_seconds=999999,
        )

        mock_db = MagicMock()
        mock_item = MagicMock()
        mock_item.url = "https://youtube.com/watch?v=abc12345678"
        mock_item.id = 1
        mock_db.query.return_value.filter.return_value.first.return_value = mock_item
        mock_session_cls.return_value = mock_db

        task = parse_metadata_task
        task.request.retries = 0

        result = task(1)

        assert result["status"] == "completed"
        assert result["skipped"] == "duration_limit"
        assert mock_item.status == ContentStatus.COMPLETED


# ---------------------------------------------------------------------------
# download_audio_task
# ---------------------------------------------------------------------------


class TestDownloadAudioTask:
    @patch.object(YouTubeParser, "download_audio")
    @patch("app.worker.tasks.download_audio.SyncSessionLocal")
    @patch("app.worker.tasks.download_audio.os.makedirs")
    def test_creates_transcription(self, mock_makedirs, mock_session_cls, mock_dl):
        """Successful download creates Transcription and dispatches transcribe task."""
        from app.worker.tasks.download_audio import download_audio_task

        mock_dl.return_value = AudioDownloadResult(
            file_path="/var/audio/1_abc.wav",
            file_size_bytes=1024,
            duration_seconds=120,
        )

        mock_db = MagicMock()
        mock_item = MagicMock()
        mock_item.url = "https://youtube.com/watch?v=abc12345678"
        mock_item.id = 1
        mock_item.deleted_at = None
        mock_db.query.return_value.filter.return_value.first.return_value = mock_item
        mock_session_cls.return_value = mock_db

        task = download_audio_task
        task.request.retries = 0

        mock_transcribe_mod = MagicMock()
        mock_transcribe_mod.transcribe_content_task.delay.return_value = MagicMock(id="celery-id")
        with patch.dict(sys.modules, {"app.worker.tasks.transcribe_content": mock_transcribe_mod}):
            result = task(1)

        assert result["status"] == "completed"
        assert mock_item.status == ContentStatus.COMPLETED
        assert mock_item.audio_path == "/var/audio/1_abc.wav"
        mock_db.add.assert_called_once()
        mock_transcribe_mod.transcribe_content_task.delay.assert_called_once()

    @patch("app.worker.tasks.download_audio.SyncSessionLocal")
    def test_skips_deleted_content(self, mock_session_cls):
        """Deleted content item → return early with skipped status."""
        from app.worker.tasks.download_audio import download_audio_task

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_session_cls.return_value = mock_db

        task = download_audio_task
        task.request.retries = 0

        result = task(999)

        assert result["status"] == "skipped"


# ---------------------------------------------------------------------------
# transcribe_content_task
# ---------------------------------------------------------------------------


class TestTranscribeContentTask:
    @patch("app.worker.tasks.transcribe_content.os.remove")
    @patch("app.worker.tasks.transcribe_content.os.path.exists", return_value=True)
    @patch("app.worker.tasks.transcribe_content.WhisperTranscriber")
    @patch("app.worker.tasks.transcribe_content.SyncSessionLocal")
    def test_transcribe_success(self, mock_session_cls, mock_whisper_cls, mock_exists, mock_remove):
        """Successful transcription → text saved, audio deleted, status=COMPLETED."""
        from app.worker.tasks.transcribe_content import transcribe_content_task

        mock_whisper_cls.return_value.transcribe.return_value = TranscriptionResult(
            text="Hello world",
            language="en",
            duration_seconds=120,
        )

        mock_db = MagicMock()
        mock_transcription = MagicMock()
        mock_transcription.id = 1
        mock_transcription.content_item_id = 1

        mock_item = MagicMock()
        mock_item.audio_path = "/var/audio/1_abc.wav"
        mock_item.deleted_at = None

        mock_db.query.return_value.filter.return_value.first.side_effect = [
            mock_transcription,
            mock_item,
        ]
        mock_session_cls.return_value = mock_db

        task = transcribe_content_task
        task.request.retries = 0

        result = task(1)

        assert result["status"] == "completed"
        assert mock_transcription.text == "Hello world"
        assert mock_transcription.language == "en"
        assert mock_transcription.status == TranscriptionStatus.COMPLETED
        mock_remove.assert_called_once_with("/var/audio/1_abc.wav")

    @patch("app.worker.tasks.transcribe_content.SyncSessionLocal")
    def test_deleted_content_skipped(self, mock_session_cls):
        """Content deleted (deleted_at set) → skip transcription."""
        from app.worker.tasks.transcribe_content import transcribe_content_task

        mock_db = MagicMock()
        mock_transcription = MagicMock()
        mock_transcription.content_item_id = 1

        mock_db.query.return_value.filter.return_value.first.side_effect = [
            mock_transcription,
            None,
        ]
        mock_session_cls.return_value = mock_db

        task = transcribe_content_task
        task.request.retries = 0

        result = task(1)

        assert result["status"] == "skipped"

    @patch("app.worker.tasks.transcribe_content.os.path.exists", return_value=False)
    @patch("app.worker.tasks.transcribe_content.SyncSessionLocal")
    def test_missing_audio(self, mock_session_cls, mock_exists):
        """Audio file missing → status=FAILED."""
        from app.worker.tasks.transcribe_content import transcribe_content_task

        mock_db = MagicMock()
        mock_transcription = MagicMock()
        mock_transcription.id = 1
        mock_transcription.content_item_id = 1

        mock_item = MagicMock()
        mock_item.audio_path = "/var/audio/missing.wav"
        mock_item.deleted_at = None

        mock_db.query.return_value.filter.return_value.first.side_effect = [
            mock_transcription,
            mock_item,
        ]
        mock_session_cls.return_value = mock_db

        task = transcribe_content_task
        task.request.retries = 0

        result = task(1)

        assert result["status"] == "failed"
        assert "Audio file not found" in result["error"]

    @patch("app.worker.tasks.transcribe_content.SyncSessionLocal")
    def test_timeout(self, mock_session_cls):
        """SoftTimeLimitExceeded → FAILED with timeout message."""
        from celery.exceptions import SoftTimeLimitExceeded

        from app.worker.tasks.transcribe_content import transcribe_content_task

        mock_db = MagicMock()
        mock_transcription = MagicMock()
        mock_transcription.id = 1
        mock_transcription.content_item_id = 1

        mock_item = MagicMock()
        mock_item.audio_path = "/var/audio/1.wav"
        mock_item.deleted_at = None

        mock_db.query.return_value.filter.return_value.first.side_effect = [
            mock_transcription,
            mock_item,
            mock_transcription,
        ]
        mock_session_cls.return_value = mock_db

        with (
            patch("app.worker.tasks.transcribe_content.os.path.exists", return_value=True),
            patch("app.worker.tasks.transcribe_content.WhisperTranscriber") as mock_whisper_cls,
        ):
            mock_whisper_cls.return_value.transcribe.side_effect = SoftTimeLimitExceeded()

            task = transcribe_content_task
            task.request.retries = 0

            result = task(1)

        assert result["status"] == "failed"
        assert result["error"] == "timeout"
