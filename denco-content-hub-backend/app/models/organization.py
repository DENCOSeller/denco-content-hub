from __future__ import annotations

from sqlalchemy import Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class Organization(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    is_default: Mapped[bool] = mapped_column(default=False, nullable=False)
    staff_org_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        unique=True,
        default=None,
    )
    client_org_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        unique=True,
        default=None,
    )
    org_source: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        server_default="staff",
    )

    workspaces: Mapped[list[Workspace]] = relationship(back_populates="organization")  # noqa: F821

    __table_args__ = (
        Index(
            "ix_organizations_slug_active",
            "slug",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
