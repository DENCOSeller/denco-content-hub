from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.content_item import ContentItem


class ContentChatMessage(Base):
    __tablename__ = "content_chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    content_item_id: Mapped[int] = mapped_column(ForeignKey("content_items.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    content_item: Mapped[ContentItem] = relationship(back_populates="chat_messages")

    __table_args__ = (
        Index("ix_content_chat_messages_content_item_id", "content_item_id"),
    )
