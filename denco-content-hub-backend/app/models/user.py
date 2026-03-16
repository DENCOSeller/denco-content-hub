from sqlalchemy import Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class User(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    is_platform_owner: Mapped[bool] = mapped_column(default=False, nullable=False)

    __table_args__ = (
        Index(
            "ix_users_email_active",
            "email",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
