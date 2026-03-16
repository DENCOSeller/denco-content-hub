from __future__ import annotations

import structlog

from app.integrations.sources.base import BaseSourceAdapter, SourceExtractionError
from app.integrations.sources.manual_text import ManualTextAdapter
from app.integrations.sources.pdf import PDFAdapter
from app.integrations.sources.web_page import WebPageAdapter
from app.integrations.sources.youtube import YouTubeAdapter

logger = structlog.get_logger()

# ------------------------------------------------------------------ #
# Module-level registry — one shared mapping for the whole process.   #
# ------------------------------------------------------------------ #

_ADAPTERS: dict[str, type[BaseSourceAdapter]] = {
    "youtube_video": YouTubeAdapter,
    "pdf_file": PDFAdapter,
    "web_page": WebPageAdapter,
    "manual_text": ManualTextAdapter,
}


def register_adapter(source_type: str, adapter_cls: type[BaseSourceAdapter]) -> None:
    """Register a new adapter (or override an existing one)."""
    _ADAPTERS[source_type] = adapter_cls
    logger.info("source_adapter_registered", source_type=source_type, cls=adapter_cls.__name__)


def get_adapter(source_type: str) -> BaseSourceAdapter:
    """Instantiate and return an adapter for *source_type*.

    Raises ``SourceExtractionError`` if the type is unknown.
    """
    cls = _ADAPTERS.get(source_type)
    if cls is None:
        available = ", ".join(sorted(_ADAPTERS))
        raise SourceExtractionError(
            f"Unknown source type '{source_type}'. Available: {available}"
        )
    return cls()


def available_source_types() -> list[str]:
    """Return sorted list of registered source type names."""
    return sorted(_ADAPTERS)
