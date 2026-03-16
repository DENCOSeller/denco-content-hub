from __future__ import annotations

import enum

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class WorkspaceRole(enum.StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"
    CONTRACTOR = "contractor"


class Workspace(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    is_personal: Mapped[bool] = mapped_column(default=False, nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)

    company: Mapped[Company] = relationship(back_populates="workspaces")  # noqa: F821

    __table_args__ = (
        Index(
            "ix_workspaces_slug_active",
            "slug",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class WorkspaceMember(Base, TimestampMixin):
    __tablename__ = "workspace_members"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), nullable=False)
    role: Mapped[WorkspaceRole] = mapped_column(nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "workspace_id", name="uq_member_user_workspace"),
        Index("ix_workspace_members_workspace_id", "workspace_id"),
        Index("ix_workspace_members_user_id", "user_id"),
    )
