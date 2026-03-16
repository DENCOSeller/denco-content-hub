from __future__ import annotations

from abc import ABC, abstractmethod


class SourceExtractionError(Exception):
    """Raised when a source adapter fails to extract content."""


class BaseSourceAdapter(ABC):
    """Abstract base class for all source adapters.

    Each adapter knows how to validate, extract metadata, and extract text
    from a specific source type (YouTube, PDF, web page, manual text, etc.).
    """

    @abstractmethod
    def validate_input(self, data: dict) -> bool:
        """Check whether *data* contains everything this adapter needs.

        Returns ``True`` if valid, raises ``SourceExtractionError`` otherwise.
        """

    @abstractmethod
    def extract_metadata(self, data: dict) -> dict:
        """Return a metadata dict (title, description, etc.) for the source."""

    @abstractmethod
    def extract_text(self, data: dict) -> str:
        """Return the full extracted text suitable for downstream analysis."""

    def supports_transcription(self) -> bool:  # noqa: PLR6301
        """Whether this source type supports audio transcription."""
        return False
