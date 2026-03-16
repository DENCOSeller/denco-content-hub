from __future__ import annotations

from sqlalchemy import Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class Company(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    is_default: Mapped[bool] = mapped_column(default=False, nullable=False)

    workspaces: Mapped[list[Workspace]] = relationship(back_populates="company")  # noqa: F821

    __table_args__ = (
        Index(
            "ix_companies_slug_active",
            "slug",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
