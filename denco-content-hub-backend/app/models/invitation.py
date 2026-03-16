import enum
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.workspace import WorkspaceRole


class InvitationStatus(enum.StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class WorkspaceInvitation(Base, TimestampMixin):
    __tablename__ = "workspace_invitations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[WorkspaceRole] = mapped_column(nullable=False)
    invited_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    token: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[InvitationStatus] = mapped_column(default=InvitationStatus.PENDING, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_invitations_token", "token", unique=True),
        Index(
            "uq_invitations_workspace_email_pending",
            "workspace_id",
            "email",
            unique=True,
            postgresql_where=text("status = 'PENDING'"),
        ),
        Index("ix_invitations_email_status", "email", "status"),
    )
