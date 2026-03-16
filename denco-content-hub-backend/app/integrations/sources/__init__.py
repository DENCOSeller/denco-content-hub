from app.integrations.sources.base import BaseSourceAdapter, SourceExtractionError
from app.integrations.sources.manual_text import ManualTextAdapter
from app.integrations.sources.pdf import PDFAdapter
from app.integrations.sources.registry import (
    available_source_types,
    get_adapter,
    register_adapter,
)
from app.integrations.sources.web_page import WebPageAdapter
from app.integrations.sources.youtube import YouTubeAdapter

__all__ = [
    "BaseSourceAdapter",
    "ManualTextAdapter",
    "PDFAdapter",
    "SourceExtractionError",
    "WebPageAdapter",
    "YouTubeAdapter",
    "available_source_types",
    "get_adapter",
    "register_adapter",
]
