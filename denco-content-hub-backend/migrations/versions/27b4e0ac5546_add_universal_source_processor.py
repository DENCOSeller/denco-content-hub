"""add universal source processor

Revision ID: 27b4e0ac5546
Revises: cd44ad28524b
Create Date: 2026-03-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '27b4e0ac5546'
down_revision: Union[str, None] = 'cd44ad28524b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Расширяем enum sourcetype новыми значениями
    op.execute("ALTER TYPE sourcetype ADD VALUE IF NOT EXISTS 'pdf_file'")
    op.execute("ALTER TYPE sourcetype ADD VALUE IF NOT EXISTS 'web_page'")
    op.execute("ALTER TYPE sourcetype ADD VALUE IF NOT EXISTS 'manual_text'")

    # 2. Добавляем поле extracted_text в content_items
    op.add_column('content_items', sa.Column('extracted_text', sa.Text(), nullable=True))

    # 3. Создаём таблицу content_analyses
    op.create_table('content_analyses',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('content_item_id', sa.Integer(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('theses', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('hooks', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('storyboard', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='pending', nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('celery_task_id', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['content_item_id'], ['content_items.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_content_analyses_content_item_id', 'content_analyses', ['content_item_id'], unique=True)
    op.create_index('ix_content_analyses_status', 'content_analyses', ['status'], unique=False)

    # 4. Создаём таблицу content_chat_messages
    op.create_table('content_chat_messages',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('content_item_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['content_item_id'], ['content_items.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_content_chat_messages_content_item_id', 'content_chat_messages', ['content_item_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_content_chat_messages_content_item_id', table_name='content_chat_messages')
    op.drop_table('content_chat_messages')
    op.drop_index('ix_content_analyses_status', table_name='content_analyses')
    op.drop_index('ix_content_analyses_content_item_id', table_name='content_analyses')
    op.drop_table('content_analyses')
    op.drop_column('content_items', 'extracted_text')
    # Примечание: ALTER TYPE ... ADD VALUE нельзя откатить в транзакции.
    # Значения enum остаются после downgrade — это безопасно.
