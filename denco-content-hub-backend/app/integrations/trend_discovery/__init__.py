"""Trend Discovery platform adapters."""

from app.integrations.trend_discovery.instagram_trends import (
    ApifyInstagramTrendProvider,
    TrendDiscoveryProvider,
)
from app.integrations.trend_discovery.youtube_trends import YouTubeTrendDiscovery

__all__ = [
    "ApifyInstagramTrendProvider",
    "TrendDiscoveryProvider",
    "YouTubeTrendDiscovery",
]
