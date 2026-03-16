from __future__ import annotations

import enum
from datetime import datetime  # noqa: TC003 — required at runtime by SQLAlchemy

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class ChatRole(enum.StrEnum):
    USER = "user"
    ASSISTANT = "assistant"


class ChatSession(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    page_context: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    messages: Mapped[list[ChatMessage]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index(
            "ix_cs_user_active",
            "user_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[ChatRole] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    page_context: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    session: Mapped[ChatSession] = relationship(back_populates="messages")
    attachments: Mapped[list[ChatAttachment]] = relationship(
        back_populates="message",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (Index("ix_cm_session", "session_id"),)


class ChatAttachment(Base):
    __tablename__ = "chat_attachments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    message_id: Mapped[int | None] = mapped_column(
        ForeignKey("chat_messages.id", ondelete="CASCADE"),
        nullable=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_path: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    message: Mapped[ChatMessage | None] = relationship(back_populates="attachments")

    __table_args__ = (Index("ix_ca_message", "message_id"),)


class AiSetting(Base):
    __tablename__ = "ai_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    updated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )
