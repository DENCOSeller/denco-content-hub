"""Tests for TranscriptionService (unit, uses real DB via async fixtures)."""

from __future__ import annotations

import sys
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest

from app.exceptions import AppException, NotFoundException
from app.models.content_item import ContentItem, ContentStatus, SourceType
from app.models.transcription import Transcription, TranscriptionStatus
from app.services.transcription_service import TranscriptionService

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_workspace_and_user(db: AsyncSession) -> tuple[int, int]:
    """Create a minimal user + workspace in test DB, return (workspace_id, user_id)."""
    from app.models.user import User
    from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
    from app.utils.security import hash_password

    user = User(email="svc@test.com", hashed_password=hash_password("Pass1234"), name="SvcUser")
    db.add(user)
    await db.flush()

    from app.models.company import Company
    from sqlalchemy import select

    result = await db.execute(select(Company).where(Company.is_default.is_(True)))
    default_company = result.scalar_one()

    workspace = Workspace(name="Test WS", slug="test-ws", company_id=default_company.id)
    db.add(workspace)
    await db.flush()

    member = WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER)
    db.add(member)
    await db.flush()
    await db.commit()

    return workspace.id, user.id


async def _create_content(db: AsyncSession, workspace_id: int, user_id: int, **kw) -> ContentItem:
    defaults = {
        "workspace_id": workspace_id,
        "added_by_user_id": user_id,
        "url": "https://youtube.com/watch?v=abc12345678",
        "source_type": SourceType.YOUTUBE_VIDEO,
        "video_id": "abc12345678",
        "status": ContentStatus.COMPLETED,
    }
    defaults.update(kw)
    item = ContentItem(**defaults)
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def _create_transcription(db: AsyncSession, content_id: int, **kw) -> Transcription:
    defaults = {
        "content_item_id": content_id,
        "status": TranscriptionStatus.COMPLETED,
        "text": "Hello world",
        "language": "en",
        "duration_seconds": 120,
        "whisper_model": "small",
    }
    defaults.update(kw)
    t = Transcription(**defaults)
    db.add(t)
    await db.flush()
    await db.refresh(t)
    return t


# ---------------------------------------------------------------------------
# get_transcription
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_transcription_success(db_session: AsyncSession) -> None:
    ws_id, user_id = await _create_workspace_and_user(db_session)
    content = await _create_content(db_session, ws_id, user_id)
    trans = await _create_transcription(db_session, content.id)
    await db_session.commit()

    service = TranscriptionService(db_session)
    result = await service.get_transcription(ws_id, content.id)

    assert result.id == trans.id
    assert result.text == "Hello world"
    assert result.language == "en"


@pytest.mark.asyncio
async def test_get_transcription_content_not_found(db_session: AsyncSession) -> None:
    ws_id, _ = await _create_workspace_and_user(db_session)

    service = TranscriptionService(db_session)
    with pytest.raises(NotFoundException, match="Content not found"):
        await service.get_transcription(ws_id, 9999)


@pytest.mark.asyncio
async def test_get_transcription_no_transcription(db_session: AsyncSession) -> None:
    ws_id, user_id = await _create_workspace_and_user(db_session)
    content = await _create_content(db_session, ws_id, user_id)
    await db_session.commit()

    service = TranscriptionService(db_session)
    with pytest.raises(NotFoundException, match="Transcription not found"):
        await service.get_transcription(ws_id, content.id)


@pytest.mark.asyncio
async def test_get_transcription_wrong_workspace(db_session: AsyncSession) -> None:
    """Content exists in ws1, request in ws2 → NotFoundException."""
    ws_id, user_id = await _create_workspace_and_user(db_session)
    content = await _create_content(db_session, ws_id, user_id)
    await _create_transcription(db_session, content.id)
    await db_session.commit()

    service = TranscriptionService(db_session)
    with pytest.raises(NotFoundException, match="Content not found"):
        await service.get_transcription(9999, content.id)


# ---------------------------------------------------------------------------
# retry_transcription
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_retry_transcription_success(db_session: AsyncSession) -> None:
    ws_id, user_id = await _create_workspace_and_user(db_session)
    content = await _create_content(db_session, ws_id, user_id, audio_path="/var/audio/test.wav")
    trans = await _create_transcription(
        db_session,
        content.id,
        status=TranscriptionStatus.FAILED,
        error_message="Whisper crashed",
    )
    await db_session.commit()

    service = TranscriptionService(db_session)

    mock_task_mod = MagicMock()
    mock_task_mod.transcribe_content_task.delay.return_value.id = "celery-123"
    with patch.dict(sys.modules, {"app.worker.tasks.transcribe_content": mock_task_mod}):
        result = await service.retry_transcription(ws_id, content.id)

    assert result.status == TranscriptionStatus.PENDING
    assert result.error_message is None
    assert result.retry_count == 0
    mock_task_mod.transcribe_content_task.delay.assert_called_once_with(trans.id)


@pytest.mark.asyncio
async def test_retry_transcription_not_failed(db_session: AsyncSession) -> None:
    ws_id, user_id = await _create_workspace_and_user(db_session)
    content = await _create_content(db_session, ws_id, user_id)
    await _create_transcription(db_session, content.id, status=TranscriptionStatus.COMPLETED)
    await db_session.commit()

    service = TranscriptionService(db_session)
    with pytest.raises(AppException, match="FAILED"):
        await service.retry_transcription(ws_id, content.id)


@pytest.mark.asyncio
async def test_retry_transcription_no_audio(db_session: AsyncSession) -> None:
    ws_id, user_id = await _create_workspace_and_user(db_session)
    content = await _create_content(db_session, ws_id, user_id, audio_path=None)
    await _create_transcription(db_session, content.id, status=TranscriptionStatus.FAILED)
    await db_session.commit()

    service = TranscriptionService(db_session)
    with pytest.raises(AppException, match="Audio file not available"):
        await service.retry_transcription(ws_id, content.id)
