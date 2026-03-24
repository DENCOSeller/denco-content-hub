"""add_staff_employee_id_to_users

Revision ID: 7bb6fdcdad61
Revises: e96df782c808
Create Date: 2026-03-19 19:33:02.968857

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7bb6fdcdad61'
down_revision: Union[str, None] = 'e96df782c808'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("staff_employee_id", sa.Integer(), nullable=True),
    )
    op.create_unique_constraint(
        "uq_users_staff_employee_id",
        "users",
        ["staff_employee_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_staff_employee_id", "users", type_="unique")
    op.drop_column("users", "staff_employee_id")
