"""Section configuration per source type.

Each source type receives a different set of analysis sections.
Sections are keys of IntelligenceResult fields.
"""

from __future__ import annotations

SECTION_CONFIG: dict[str, list[str]] = {
    "reference": [
        "summary",
        "key_points",
        "hooks",
        "topics",
        "tone",
        "quality_score",
        "content_ideas",
        "content_structure",
        "storyboard",
        "audience_insights",
        "production_notes",
    ],
    "competitor_post": [
        "summary",
        "key_points",
        "hooks",
        "topics",
        "tone",
        "quality_score",
        "content_ideas",
    ],
    "trend_item": [
        "summary",
        "topics",
        "content_ideas",
    ],
}

# storyboard is only relevant for video content
VIDEO_ONLY_SECTIONS: set[str] = {"storyboard"}

PROMPT_VERSION = "1.0"


def get_sections(source_type: str, *, is_video: bool = False) -> list[str]:
    """Return list of sections for given source type.

    Filters out video-only sections when content is not video.
    """
    sections = SECTION_CONFIG.get(source_type, SECTION_CONFIG["competitor_post"])
    if not is_video:
        sections = [s for s in sections if s not in VIDEO_ONLY_SECTIONS]
    return sections
