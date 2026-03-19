from __future__ import annotations

import os

import structlog

from app.integrations.sources.base import BaseSourceAdapter, SourceExtractionError

logger = structlog.get_logger()


class PDFAdapter(BaseSourceAdapter):
    """Extract text and metadata from a local PDF file using PyMuPDF.

    Expected *data* keys:
    - ``file_path`` (str) — absolute path to the PDF file on disk.
    """

    def validate_input(self, data: dict) -> bool:
        file_path: str = data.get("file_path", "")
        if not file_path:
            raise SourceExtractionError("Missing 'file_path' in input data")
        if not file_path.lower().endswith(".pdf"):
            raise SourceExtractionError(f"File does not have a .pdf extension: {file_path}")
        if not os.path.isfile(file_path):
            raise SourceExtractionError(f"PDF file not found: {file_path}")
        return True

    def extract_metadata(self, data: dict) -> dict:
        file_path: str = data["file_path"]
        try:
            import fitz  # PyMuPDF

            doc = fitz.open(file_path)
        except Exception as exc:
            raise SourceExtractionError(f"Failed to open PDF: {exc}") from exc

        pdf_meta = doc.metadata or {}
        title = pdf_meta.get("title") or os.path.splitext(os.path.basename(file_path))[0]
        metadata = {
            "title": title,
            "author": pdf_meta.get("author"),
            "subject": pdf_meta.get("subject"),
            "page_count": doc.page_count,
            "file_path": file_path,
        }
        doc.close()
        return metadata

    def extract_text(self, data: dict) -> str:
        file_path: str = data["file_path"]
        try:
            import fitz  # PyMuPDF

            doc = fitz.open(file_path)
        except Exception as exc:
            raise SourceExtractionError(f"Failed to open PDF for text extraction: {exc}") from exc

        pages: list[str] = []
        for page in doc:
            text = page.get_text()
            if text.strip():
                pages.append(text)
        doc.close()

        full_text = "\n\n".join(pages)
        if not full_text.strip():
            raise SourceExtractionError(f"PDF contains no extractable text: {file_path}")
        return full_text
