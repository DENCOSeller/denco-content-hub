from __future__ import annotations

from app.integrations.sources.base import BaseSourceAdapter, SourceExtractionError


class ManualTextAdapter(BaseSourceAdapter):
    """Adapter for user-supplied plain text — the simplest source type.

    Expected *data* keys:
    - ``text`` (str) — the content itself.
    - ``title`` (str, optional) — human-readable title.
    """

    def validate_input(self, data: dict) -> bool:
        text: str = data.get("text", "")
        if not text or not text.strip():
            raise SourceExtractionError("Missing or empty 'text' in input data")
        return True

    def extract_metadata(self, data: dict) -> dict:
        return {
            "title": data.get("title", "Manual text"),
        }

    def extract_text(self, data: dict) -> str:
        return data["text"]
