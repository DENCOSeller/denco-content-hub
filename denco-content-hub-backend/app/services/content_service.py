from __future__ import annotations

import ipaddress
import re
import socket
from pathlib import PurePosixPath
from typing import TYPE_CHECKING
from urllib.parse import urlparse

import structlog

from app.exceptions import AppException, BadRequestException, ConflictException, NotFoundException
from app.integrations.youtube import YouTubeParser
from app.models.content_item import ContentItem, ContentStatus, SourceType
from app.models.transcription import DiarizationStatus, TranscriptionStatus
from app.repositories.content_repository import ContentRepository
from app.repositories.transcription_repository import TranscriptionRepository
from app.schemas.content import YOUTUBE_ALLOWED_HOSTS

if TYPE_CHECKING:
    from fastapi import UploadFile
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.schemas.common import PaginatedResponse, PaginationParams

logger = structlog.get_logger()


class ContentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.content_repo = ContentRepository(db)
        self.transcription_repo = TranscriptionRepository(db)

    async def add_content(
        self,
        workspace_id: int,
        user_id: int,
        url: str,
    ) -> ContentItem:
        """Add content by URL: detect type, check duplicate, create, dispatch Celery task."""
        source_type = self._detect_source_type(url)
        if not source_type:
            raise AppException("Unsupported content type", status_code=400)

        video_id: str | None = None
        if source_type == SourceType.YOUTUBE_VIDEO:
            video_id = YouTubeParser.extract_video_id(url)

        if video_id:
            existing = await self.content_repo.get_by_video_id_in_workspace(workspace_id, video_id)
            if existing:
                raise ConflictException(f"This video is already added to workspace (ID: {existing.id})")

        item = await self.content_repo.create(
            workspace_id=workspace_id,
            added_by_user_id=user_id,
            url=url,
            source_type=source_type,
            status=ContentStatus.PENDING,
            video_id=video_id,
        )
        await self.db.commit()

        from app.worker.tasks.parse_metadata import parse_metadata_task

        task = parse_metadata_task.delay(item.id)

        item.celery_task_id = task.id
        await self.db.commit()

        # Re-fetch with eager-loaded transcription for response serialization
        item = await self.content_repo.get_by_id(item.id)

        logger.info("Content added", content_id=item.id, workspace_id=workspace_id)
        return item

    async def get_content(self, workspace_id: int, content_id: int) -> ContentItem:
        """Get single content item by ID within workspace."""
        item = await self.content_repo.get_by_workspace_and_id(workspace_id, content_id)
        if not item:
            raise NotFoundException("Content not found")
        return item

    async def list_content(
        self,
        workspace_id: int,
        pagination: PaginationParams,
        status: str | None = None,
        source_type: str | None = None,
        search: str | None = None,
    ) -> PaginatedResponse[ContentItem]:
        """List content with filters and pagination."""
        status_enum = ContentStatus(status) if status else None
        type_enum = SourceType(source_type) if source_type else None

        return await self.content_repo.get_by_workspace(
            workspace_id=workspace_id,
            pagination=pagination,
            status=status_enum,
            source_type=type_enum,
            search=search,
        )

    async def delete_content(self, workspace_id: int, content_id: int) -> None:
        """Soft delete content. Revokes pipeline tasks and cleans up audio."""
        item = await self.get_content(workspace_id, content_id)

        # 1. Revoke content pipeline tasks (parse/download)
        if (
            item.status in (ContentStatus.PENDING, ContentStatus.PROCESSING, ContentStatus.DOWNLOADING)
            and item.celery_task_id
        ):
            from app.worker.celery_app import celery_app

            celery_app.control.revoke(item.celery_task_id)

        # 2. Revoke transcription task if running
        transcription = await self.transcription_repo.get_by_content_id(item.id)
        if transcription:
            if (
                transcription.status in (TranscriptionStatus.PENDING, TranscriptionStatus.PROCESSING)
                and transcription.celery_task_id
            ):
                from app.worker.celery_app import celery_app

                celery_app.control.revoke(transcription.celery_task_id)

            # 2b. Revoke diarization task if running
            if (
                transcription.diarization_status in (DiarizationStatus.PENDING, DiarizationStatus.PROCESSING)
                and transcription.diarization_celery_task_id
            ):
                from app.worker.celery_app import celery_app

                celery_app.control.revoke(transcription.diarization_celery_task_id)

        # 3. Cleanup audio file
        if item.audio_path:
            import os

            try:
                if os.path.exists(item.audio_path):
                    os.remove(item.audio_path)
            except OSError:
                logger.warning("Failed to delete audio", path=item.audio_path)

        # 4. Soft delete
        await self.content_repo.soft_delete(item.id)
        await self.db.commit()
        logger.info("Content deleted", content_id=content_id, workspace_id=workspace_id)

    async def retry_content(self, workspace_id: int, content_id: int) -> ContentItem:
        """Retry FAILED content. Full pipeline restart: parse → download → transcribe."""
        item = await self.get_content(workspace_id, content_id)

        stuck_pending = item.status == ContentStatus.PENDING and not item.celery_task_id
        if item.status != ContentStatus.FAILED and not stuck_pending:
            raise AppException(
                "Retry is only available for FAILED or stuck PENDING content",
                status_code=400,
            )

        # Cleanup old audio file
        if item.audio_path:
            import os

            try:
                if os.path.exists(item.audio_path):
                    os.remove(item.audio_path)
            except OSError:
                logger.warning("Failed to delete audio on retry", path=item.audio_path)

        # Reset content to initial state
        item.status = ContentStatus.PENDING
        item.audio_path = None
        item.error_message = None
        item.retry_count = 0
        item.processing_step = None

        # Reset transcription if exists
        transcription = await self.transcription_repo.get_by_content_id(item.id)
        if transcription:
            transcription.status = TranscriptionStatus.PENDING
            transcription.error_message = None
            transcription.text = None
            transcription.segments = None
            transcription.retry_count = 0
            transcription.celery_task_id = None
            transcription.diarization_status = None
            transcription.diarization_celery_task_id = None
            transcription.diarization_error = None

        await self.db.flush()
        await self.db.commit()

        # Always restart full pipeline from parse_metadata
        from app.worker.tasks.parse_metadata import parse_metadata_task

        task = parse_metadata_task.delay(item.id)
        item.celery_task_id = task.id
        await self.db.commit()

        item = await self.content_repo.get_by_id(item.id)

        logger.info("Content full retry", content_id=content_id, workspace_id=workspace_id)
        return item

    async def add_source(
        self,
        workspace_id: int,
        user_id: int,
        source_type: SourceType,
        source_url: str | None = None,
        title: str | None = None,
        text: str | None = None,
        file: UploadFile | None = None,
    ) -> ContentItem:
        """Add content from various sources: YouTube, PDF, web page, manual text."""
        if source_type == SourceType.YOUTUBE_VIDEO:
            if not source_url:
                raise BadRequestException("source_url is required for youtube_video")
            return await self._add_youtube_source(workspace_id, user_id, source_url)

        if source_type == SourceType.PDF_FILE:
            if not file:
                raise BadRequestException("file is required for pdf_file")
            return await self._add_pdf_source(workspace_id, user_id, file)

        if source_type == SourceType.WEB_PAGE:
            if not source_url:
                raise BadRequestException("source_url is required for web_page")
            return await self._add_webpage_source(workspace_id, user_id, source_url)

        if source_type == SourceType.MANUAL_TEXT:
            if not title or not text:
                raise BadRequestException("title and text are required for manual_text")
            return await self._add_manual_source(workspace_id, user_id, title, text)

        raise BadRequestException(f"Unsupported source_type: {source_type}")

    async def _add_youtube_source(
        self,
        workspace_id: int,
        user_id: int,
        url: str,
    ) -> ContentItem:
        """YouTube source: validate domain, check duplicate, create item, dispatch parse_metadata_task."""
        parsed = urlparse(url)
        if parsed.hostname not in YOUTUBE_ALLOWED_HOSTS:
            raise BadRequestException("Invalid YouTube URL")

        video_id = YouTubeParser.extract_video_id(url)
        if video_id:
            existing = await self.content_repo.get_by_video_id_in_workspace(workspace_id, video_id)
            if existing:
                raise ConflictException(f"This video is already added to workspace (ID: {existing.id})")

        item = await self.content_repo.create(
            workspace_id=workspace_id,
            added_by_user_id=user_id,
            url=url,
            source_type=SourceType.YOUTUBE_VIDEO,
            status=ContentStatus.PENDING,
            video_id=video_id,
        )
        await self.db.commit()

        from app.worker.tasks.parse_metadata import parse_metadata_task

        task = parse_metadata_task.delay(item.id)
        item.celery_task_id = task.id
        await self.db.commit()

        item = await self.content_repo.get_by_id(item.id)
        logger.info("YouTube source added", content_id=item.id, workspace_id=workspace_id)
        return item

    async def _add_pdf_source(
        self,
        workspace_id: int,
        user_id: int,
        file: UploadFile,
    ) -> ContentItem:
        """PDF source: validate, save file, create item, dispatch process_pdf_task."""
        from pathlib import Path

        # Validate content type
        if file.content_type != "application/pdf":
            raise BadRequestException("Only PDF files are allowed")

        # Sanitize filename: take basename, remove dangerous chars, check extension
        raw_name = file.filename or "document.pdf"
        filename = PurePosixPath(raw_name).name
        filename = re.sub(r"[^\w.\-]", "_", filename)
        if not filename.lower().endswith(".pdf"):
            raise BadRequestException("File must have .pdf extension")

        url = f"file://{filename}"

        item = await self.content_repo.create(
            workspace_id=workspace_id,
            added_by_user_id=user_id,
            url=url,
            source_type=SourceType.PDF_FILE,
            status=ContentStatus.PENDING,
            title=filename,
        )
        await self.db.flush()

        # Write file to disk before commit so DB record is consistent
        upload_dir = Path(f"/var/denco/uploads/{workspace_id}/{item.id}")
        upload_dir.mkdir(parents=True, exist_ok=True)
        file_path = str(upload_dir / filename)

        content = await file.read()
        Path(file_path).write_bytes(content)

        item.raw_file_path = file_path
        await self.db.commit()

        from app.worker.tasks.process_pdf import process_pdf_task

        task = process_pdf_task.delay(item.id)
        item.celery_task_id = task.id
        await self.db.commit()

        item = await self.content_repo.get_by_id(item.id)
        logger.info("PDF source added", content_id=item.id, workspace_id=workspace_id)
        return item

    async def _add_webpage_source(
        self,
        workspace_id: int,
        user_id: int,
        url: str,
    ) -> ContentItem:
        """Web page source: validate URL scheme, create item, dispatch process_webpage_task."""
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise BadRequestException("Only http:// and https:// URLs are allowed")

        # SSRF protection: block private/reserved IP addresses
        hostname = parsed.hostname
        if not hostname:
            raise BadRequestException("Invalid URL: missing hostname")
        try:
            addr_infos = socket.getaddrinfo(hostname, None)
        except socket.gaierror:
            raise BadRequestException("Cannot resolve hostname")
        for addr_info in addr_infos:
            ip = ipaddress.ip_address(addr_info[4][0])
            if ip.is_private or ip.is_reserved or ip.is_loopback or ip.is_link_local:
                raise BadRequestException("URLs pointing to private/internal networks are not allowed")

        item = await self.content_repo.create(
            workspace_id=workspace_id,
            added_by_user_id=user_id,
            url=url,
            source_type=SourceType.WEB_PAGE,
            status=ContentStatus.PENDING,
        )
        await self.db.commit()

        from app.worker.tasks.process_webpage import process_webpage_task

        task = process_webpage_task.delay(item.id)
        item.celery_task_id = task.id
        await self.db.commit()

        item = await self.content_repo.get_by_id(item.id)
        logger.info("Web page source added", content_id=item.id, workspace_id=workspace_id)
        return item

    async def _add_manual_source(
        self,
        workspace_id: int,
        user_id: int,
        title: str,
        text: str,
    ) -> ContentItem:
        """Manual text source: create item with extracted_text, status=COMPLETED."""
        item = await self.content_repo.create(
            workspace_id=workspace_id,
            added_by_user_id=user_id,
            url="manual://text",
            source_type=SourceType.MANUAL_TEXT,
            status=ContentStatus.COMPLETED,
            title=title,
            extracted_text=text,
        )
        await self.db.commit()

        item = await self.content_repo.get_by_id(item.id)
        logger.info("Manual text source added", content_id=item.id, workspace_id=workspace_id)
        return item

    @staticmethod
    def _detect_source_type(url: str) -> SourceType | None:
        """Detect content source type by URL domain."""
        parsed = urlparse(url)
        if parsed.hostname in YOUTUBE_ALLOWED_HOSTS:
            return SourceType.YOUTUBE_VIDEO
        return None
