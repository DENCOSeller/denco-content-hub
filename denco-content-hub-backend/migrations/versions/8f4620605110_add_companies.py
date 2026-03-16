"""add_companies

Revision ID: 8f4620605110
Revises: 1df12fc898d5
Create Date: 2026-03-12 19:56:46.378369

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8f4620605110"
down_revision: str | None = "1df12fc898d5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create companies table
    op.create_table(
        "companies",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_companies_slug_active",
        "companies",
        ["slug"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # 2. Seed DENCO (use execute, NOT bulk_insert — doesn't support func.now())
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "INSERT INTO companies (name, slug, is_default, created_at, updated_at) "
            "VALUES ('DENCO', 'denco', true, now(), now())"
        )
    )
    result = conn.execute(sa.text("SELECT id FROM companies WHERE slug = 'denco'"))
    denco_id = result.scalar_one()

    # 3. Add company_id as nullable first
    op.add_column("workspaces", sa.Column("company_id", sa.Integer(), nullable=True))

    # 4. Backfill all existing workspaces with DENCO (parameterized — no f-string)
    conn.execute(
        sa.text("UPDATE workspaces SET company_id = :cid"),
        {"cid": denco_id},
    )

    # 5. Set NOT NULL
    op.alter_column("workspaces", "company_id", nullable=False)

    # 6. Add FK with ON DELETE RESTRICT
    op.create_foreign_key(
        "fk_workspaces_company_id",
        "workspaces",
        "companies",
        ["company_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint("fk_workspaces_company_id", "workspaces", type_="foreignkey")
    op.drop_column("workspaces", "company_id")
    op.drop_index("ix_companies_slug_active", table_name="companies", postgresql_where=sa.text("deleted_at IS NULL"))
    op.drop_table("companies")
