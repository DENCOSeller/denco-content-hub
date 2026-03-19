from __future__ import annotations

import structlog

from app.integrations.sources.base import BaseSourceAdapter, SourceExtractionError

logger = structlog.get_logger()


class WebPageAdapter(BaseSourceAdapter):
    """Extract main text content from a web page using *trafilatura*.

    Expected *data* keys:
    - ``url`` (str) — full URL starting with ``http://`` or ``https://``.
    """

    def validate_input(self, data: dict) -> bool:
        url: str = data.get("url", "")
        if not url:
            raise SourceExtractionError("Missing 'url' in input data")
        if not url.lower().startswith("http"):
            raise SourceExtractionError(f"URL must start with http:// or https://: {url}")
        return True

    def extract_metadata(self, data: dict) -> dict:
        url: str = data["url"]
        try:
            import trafilatura

            downloaded = trafilatura.fetch_url(url)
        except Exception as exc:
            raise SourceExtractionError(f"Failed to fetch web page: {exc}") from exc

        if not downloaded:
            raise SourceExtractionError(f"Could not download page: {url}")

        metadata = trafilatura.extract(
            downloaded,
            output_format="json",
            include_comments=False,
            with_metadata=True,
        )

        # trafilatura.extract with output_format="json" returns a JSON string
        if metadata:
            import json

            try:
                meta_dict = json.loads(metadata)
            except (json.JSONDecodeError, TypeError):
                meta_dict = {}
        else:
            meta_dict = {}

        return {
            "title": meta_dict.get("title", url),
            "author": meta_dict.get("author"),
            "hostname": meta_dict.get("hostname"),
            "date": meta_dict.get("date"),
            "url": url,
        }

    def extract_text(self, data: dict) -> str:
        url: str = data["url"]
        try:
            import trafilatura

            downloaded = trafilatura.fetch_url(url)
        except Exception as exc:
            raise SourceExtractionError(f"Failed to fetch web page for text extraction: {exc}") from exc

        if not downloaded:
            raise SourceExtractionError(f"Could not download page: {url}")

        text = trafilatura.extract(
            downloaded,
            include_comments=False,
            include_tables=True,
        )

        if not text or not text.strip():
            raise SourceExtractionError(f"No extractable text content on page: {url}")
        return text
