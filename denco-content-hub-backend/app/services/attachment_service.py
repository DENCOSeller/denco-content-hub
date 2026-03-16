from __future__ import annotations

import base64
import uuid
from pathlib import Path
from typing import TYPE_CHECKING, Any

import structlog

from app.config import settings as app_settings
from app.exceptions import BadRequestException
from app.repositories.chat_repository import ChatAttachmentRepository
from app.schemas.chat import ChatAttachmentResponse

if TYPE_CHECKING:
    from fastapi import UploadFile
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.chat import ChatAttachment

logger = structlog.get_logger()

ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


async def upload_attachment(db: AsyncSession, file: UploadFile, user_id: int) -> ChatAttachmentResponse:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise BadRequestException(f"Unsupported file type: {file.content_type}")

    max_bytes = app_settings.ai_attachment_max_size_mb * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise BadRequestException(f"File too large (max {app_settings.ai_attachment_max_size_mb}MB)")

    storage_dir = Path(app_settings.ai_attachments_path)
    storage_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "file").suffix
    stored_name = f"{uuid.uuid4().hex}{ext}"
    stored_path = storage_dir / stored_name
    stored_path.write_bytes(content)

    repo = ChatAttachmentRepository(db)
    attachment = await repo.create(
        user_id=user_id,
        original_name=file.filename or "file",
        stored_path=str(stored_path),
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
    )
    await db.commit()
    logger.info("Attachment uploaded", attachment_id=attachment.id, user_id=user_id)
    return ChatAttachmentResponse.model_validate(attachment)


def build_attachment_blocks(attachments: list[ChatAttachment]) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for att in attachments:
        file_path = Path(att.stored_path)
        if not file_path.exists():
            continue
        data = file_path.read_bytes()
        b64 = base64.standard_b64encode(data).decode("ascii")

        if att.content_type.startswith("image/"):
            blocks.append(
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": att.content_type, "data": b64},
                }
            )
        elif att.content_type == "application/pdf":
            blocks.append(
                {
                    "type": "document",
                    "source": {"type": "base64", "media_type": "application/pdf", "data": b64},
                }
            )
        elif att.content_type in (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        ):
            text = _extract_docx_text(file_path)
            if text:
                blocks.append({"type": "text", "text": f"[Файл: {att.original_name}]\n{text}"})
    return blocks


def _extract_docx_text(file_path: Path) -> str:
    try:
        from docx import Document

        doc = Document(str(file_path))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception:
        logger.warning("Failed to extract DOCX text", path=str(file_path))
        return ""
