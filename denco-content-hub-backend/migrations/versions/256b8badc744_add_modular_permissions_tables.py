"""add modular permissions tables

Revision ID: 256b8badc744
Revises: 73a49cc035fb
Create Date: 2026-03-25 09:48:10.266743

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '256b8badc744'
down_revision: Union[str, None] = '73a49cc035fb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Создание таблиц модульной системы разрешений."""
    op.create_table(
        'module_registry',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(length=50), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_core', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
    )

    op.create_table(
        'module_permission',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('module_id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('short_code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['module_id'], ['module_registry.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
        sa.UniqueConstraint('module_id', 'short_code', name='uq_module_permission_module_short_code'),
    )
    op.create_index('ix_module_permission_code', 'module_permission', ['code'])
    op.create_index('ix_module_permission_module_id', 'module_permission', ['module_id'])

    op.create_table(
        'plan_module_access',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('plan_tier', sa.String(length=20), nullable=False),
        sa.Column('module_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['module_id'], ['module_registry.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('plan_tier', 'module_id', name='uq_plan_module_access_tier_module'),
    )
    op.create_index('ix_plan_module_access_plan_tier', 'plan_module_access', ['plan_tier'])

    op.create_table(
        'org_module_config',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('module_id', sa.Integer(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('enabled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('enabled_by_id', sa.Integer(), nullable=True),
        sa.Column('disabled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('disabled_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['module_id'], ['module_registry.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['enabled_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['disabled_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'module_id', name='uq_org_module_config_org_module'),
    )
    op.create_index('ix_org_module_config_organization_id', 'org_module_config', ['organization_id'])

    op.create_table(
        'user_permission_grant',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('permission_id', sa.Integer(), nullable=False),
        sa.Column('granted', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('granted_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['permission_id'], ['module_permission.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['granted_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'user_id', 'permission_id', name='uq_user_permission_grant_org_user_perm'),
    )
    op.create_index('ix_user_permission_grant_org_user', 'user_permission_grant', ['organization_id', 'user_id'])
    op.create_index('ix_user_permission_grant_permission_id', 'user_permission_grant', ['permission_id'])

    op.create_table(
        'role_permission_template',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('role', sa.String(length=100), nullable=False),
        sa.Column('permission_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['permission_id'], ['module_permission.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('role', 'permission_id', name='uq_role_permission_template_role_perm'),
    )
    op.create_index('ix_role_permission_template_role', 'role_permission_template', ['role'])

    op.create_table(
        'permission_audit_log',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('actor_id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('target_user_id', sa.Integer(), nullable=True),
        sa.Column('module_code', sa.String(length=50), nullable=True),
        sa.Column('permission_code', sa.String(length=100), nullable=True),
        sa.Column('details', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['target_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_permission_audit_log_org_created', 'permission_audit_log', ['organization_id', 'created_at'])
    op.create_index('ix_permission_audit_log_actor', 'permission_audit_log', ['actor_id'])


def downgrade() -> None:
    """Удаление таблиц модульной системы разрешений."""
    op.drop_table('permission_audit_log')
    op.drop_table('role_permission_template')
    op.drop_table('user_permission_grant')
    op.drop_table('org_module_config')
    op.drop_table('plan_module_access')
    op.drop_table('module_permission')
    op.drop_table('module_registry')
