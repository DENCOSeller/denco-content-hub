"""multi_idp_support

Revision ID: 669b3c47aa37
Revises: 42a0a5a45ba5
Create Date: 2026-03-21 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "669b3c47aa37"
down_revision: Union[str, None] = "42a0a5a45ba5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Users table ---
    # Rename staff_employee_id -> staff_user_id
    op.alter_column("users", "staff_employee_id", new_column_name="staff_user_id")

    # Add user_type column
    op.add_column(
        "users",
        sa.Column("user_type", sa.String(10), nullable=False, server_default="staff"),
    )

    # Add client_user_id column
    op.add_column(
        "users",
        sa.Column("client_user_id", sa.Integer(), nullable=True),
    )
    op.create_unique_constraint("uq_users_client_user_id", "users", ["client_user_id"])

    # Rename unique constraint for staff_user_id if it exists with old name
    # The old constraint was named uq_users_staff_employee_id
    try:
        op.drop_constraint("uq_users_staff_employee_id", "users", type_="unique")
        op.create_unique_constraint("uq_users_staff_user_id", "users", ["staff_user_id"])
    except Exception:
        # Constraint may already be named differently after column rename
        pass

    # --- Organizations table ---
    # Add client_org_id column
    op.add_column(
        "organizations",
        sa.Column("client_org_id", sa.Integer(), nullable=True),
    )
    op.create_unique_constraint("uq_organizations_client_org_id", "organizations", ["client_org_id"])

    # Add org_source column
    op.add_column(
        "organizations",
        sa.Column("org_source", sa.String(10), nullable=False, server_default="staff"),
    )


def downgrade() -> None:
    # --- Organizations table ---
    op.drop_column("organizations", "org_source")
    op.drop_constraint("uq_organizations_client_org_id", "organizations", type_="unique")
    op.drop_column("organizations", "client_org_id")

    # --- Users table ---
    op.drop_constraint("uq_users_client_user_id", "users", type_="unique")
    op.drop_column("users", "client_user_id")
    op.drop_column("users", "user_type")

    # Rename back staff_user_id -> staff_employee_id
    try:
        op.drop_constraint("uq_users_staff_user_id", "users", type_="unique")
    except Exception:
        pass
    op.alter_column("users", "staff_user_id", new_column_name="staff_employee_id")
    op.create_unique_constraint("uq_users_staff_employee_id", "users", ["staff_employee_id"])
