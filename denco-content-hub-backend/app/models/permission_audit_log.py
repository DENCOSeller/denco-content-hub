"""Аудит-лог изменений разрешений."""

from __future__ import annotations

import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PermissionAuditLog(Base):
    """Структурированный аудит-трейл всех мутаций разрешений."""

    __tablename__ = "permission_audit_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False,
    )
    actor_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=False,
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    target_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    module_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    permission_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    __table_args__ = (
        Index("ix_permission_audit_log_org_created", "organization_id", "created_at"),
        Index("ix_permission_audit_log_actor", "actor_id"),
    )
