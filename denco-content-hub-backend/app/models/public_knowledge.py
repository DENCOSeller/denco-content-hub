from __future__ import annotations

import enum
from datetime import datetime  # noqa: TC003

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class VisibilityMode(enum.StrEnum):
    ALL = "all"
    ACTIVE = "active"
    SELECTED = "selected"


class KgPublicLink(Base, TimestampMixin):
    __tablename__ = "kg_public_links"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        unique=True,
        nullable=False,
        server_default=text("gen_random_uuid()"),
    )
    scope_type: Mapped[str] = mapped_column(String(20), nullable=False)
    scope_id: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    visibility_mode: Mapped[str] = mapped_column(String(20), nullable=False, server_default="active")
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    # --- Relationships ---
    selected_nodes: Mapped[list[KgPublicLinkNode]] = relationship(
        "KgPublicLinkNode",
        back_populates="link",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class KgPublicLinkNode(Base):
    __tablename__ = "kg_public_link_nodes"

    link_id: Mapped[int] = mapped_column(
        ForeignKey("kg_public_links.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    node_id: Mapped[int] = mapped_column(
        ForeignKey("knowledge_nodes.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )

    # --- Relationships ---
    link: Mapped[KgPublicLink] = relationship(
        "KgPublicLink",
        back_populates="selected_nodes",
    )
