from __future__ import annotations

BLOCK_TYPES = frozenset({"paragraph", "heading", "blockquote", "listItem", "codeBlock", "bulletList", "orderedList"})


def tiptap_to_text(content: dict | None) -> str:
    """Recursively extract plain text from TipTap/ProseMirror JSON."""
    if not content:
        return ""
    parts: list[str] = []
    _walk(content, parts)
    return "\n".join(line for line in "".join(parts).split("\n") if line).strip()


def _walk(node: dict, parts: list[str]) -> None:
    if node.get("type") == "text":
        parts.append(node.get("text", ""))
        return
    for child in node.get("content", []):
        _walk(child, parts)
    if node.get("type") in BLOCK_TYPES:
        parts.append("\n")


def validate_tiptap(content: dict) -> bool:
    """Check that content is a valid TipTap document structure."""
    if not isinstance(content, dict):
        return False
    if content.get("type") != "doc":
        return False
    children = content.get("content")
    return isinstance(children, list)


def empty_tiptap_doc() -> dict:
    """Return an empty TipTap document."""
    return {"type": "doc", "content": []}
