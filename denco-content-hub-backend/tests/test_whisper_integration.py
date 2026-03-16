"""Tests for WhisperTranscriber integration."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.integrations.whisper import TranscriptionResult, WhisperError, WhisperTranscriber


class TestWhisperTranscriber:
    @pytest.mark.asyncio
    async def test_transcribe_success(self, tmp_path: object) -> None:
        """Mock whisper.load_model → TranscriptionResult."""
        audio_file = tmp_path / "test.wav"  # type: ignore[operator]
        audio_file.write_bytes(b"\x00" * 100)

        mock_model = MagicMock()
        mock_model.transcribe.return_value = {
            "text": " Hello world ",
            "language": "en",
            "segments": [{"end": 120.5}],
        }

        with patch.object(WhisperTranscriber, "_get_model", return_value=mock_model):
            transcriber = WhisperTranscriber("small")
            result = transcriber.transcribe(str(audio_file))

        assert isinstance(result, TranscriptionResult)
        assert result.text == "Hello world"
        assert result.language == "en"
        assert result.duration_seconds == 120
        mock_model.transcribe.assert_called_once_with(str(audio_file), fp16=False)

    @pytest.mark.asyncio
    async def test_file_not_found(self) -> None:
        """Non-existent path → WhisperError."""
        transcriber = WhisperTranscriber("small")
        with pytest.raises(WhisperError, match="Audio file not found"):
            transcriber.transcribe("/nonexistent/audio.wav")

    @pytest.mark.asyncio
    async def test_empty_file(self, tmp_path: object) -> None:
        """Empty audio file → WhisperError."""
        audio_file = tmp_path / "empty.wav"  # type: ignore[operator]
        audio_file.write_bytes(b"")

        transcriber = WhisperTranscriber("small")
        with pytest.raises(WhisperError, match="Empty audio file"):
            transcriber.transcribe(str(audio_file))

    @pytest.mark.asyncio
    async def test_lazy_model_loading(self, tmp_path: object) -> None:
        """_get_model is cached — called once even with multiple transcribe calls."""
        audio_file = tmp_path / "test.wav"  # type: ignore[operator]
        audio_file.write_bytes(b"\x00" * 100)

        mock_model = MagicMock()
        mock_model.transcribe.return_value = {
            "text": "test",
            "language": "en",
            "segments": [],
        }

        transcriber = WhisperTranscriber("small")
        call_count = 0

        def counting_get_model():
            nonlocal call_count
            call_count += 1
            return mock_model

        # Replace _get_model but let caching logic work naturally
        # Since _get_model caches in self._model, the first call loads, second returns cached
        with patch.object(WhisperTranscriber, "_get_model", side_effect=counting_get_model):
            transcriber.transcribe(str(audio_file))
            transcriber.transcribe(str(audio_file))

        # _get_model is called each time since we patched it (bypassing internal cache)
        # But the real test is: whisper.load_model would be called once (tested via the internal cache)
        # Since we've verified _get_model works, let's verify the caching through a different approach

        # Better test: use the real _get_model but mock whisper module
        transcriber2 = WhisperTranscriber("small")
        mock_whisper_module = MagicMock()
        mock_whisper_module.load_model.return_value = mock_model

        import sys

        sys.modules["whisper"] = mock_whisper_module
        try:
            transcriber2.transcribe(str(audio_file))
            transcriber2.transcribe(str(audio_file))
            mock_whisper_module.load_model.assert_called_once_with("small")
        finally:
            del sys.modules["whisper"]
