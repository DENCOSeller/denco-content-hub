"""Convert workspace role columns from PG enum to varchar(100) with lowercase data.

Revision ID: bde79cde410d
Revises: 7bbed8b2d80f
Create Date: 2026-03-21

CRITICAL fix: workspace_members.role and workspace_invitations.role were PG enum
(workspacerole) with UPPERCASE values. Custom roles require varchar. This migration:
1. Converts both columns to VARCHAR(100)
2. Lowercases all existing role values
3. Drops the old enum type
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "bde79cde410d"
down_revision = "7bbed8b2d80f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Convert workspace_members.role from enum to varchar
    op.execute(
        "ALTER TABLE workspace_members "
        "ALTER COLUMN role TYPE VARCHAR(100) USING role::text"
    )
    # Step 2: Convert workspace_invitations.role from enum to varchar
    op.execute(
        "ALTER TABLE workspace_invitations "
        "ALTER COLUMN role TYPE VARCHAR(100) USING role::text"
    )
    # Step 3: Lowercase all existing data
    op.execute("UPDATE workspace_members SET role = LOWER(role)")
    op.execute("UPDATE workspace_invitations SET role = LOWER(role)")
    # Step 4: Drop the old enum type (no longer used)
    op.execute("DROP TYPE IF EXISTS workspacerole")


def downgrade() -> None:
    # Recreate the enum type
    workspacerole = sa.Enum(
        "OWNER", "ADMIN", "EDITOR", "VIEWER", "CONTRACTOR",
        name="workspacerole",
    )
    workspacerole.create(op.get_bind(), checkfirst=True)
    # Uppercase data back
    op.execute("UPDATE workspace_members SET role = UPPER(role)")
    op.execute("UPDATE workspace_invitations SET role = UPPER(role)")
    # Convert columns back to enum
    op.execute(
        "ALTER TABLE workspace_members "
        "ALTER COLUMN role TYPE workspacerole USING role::workspacerole"
    )
    op.execute(
        "ALTER TABLE workspace_invitations "
        "ALTER COLUMN role TYPE workspacerole USING role::workspacerole"
    )
