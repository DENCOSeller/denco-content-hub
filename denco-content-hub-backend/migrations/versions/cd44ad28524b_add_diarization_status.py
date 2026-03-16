"""add diarization_status

Revision ID: cd44ad28524b
Revises: 4f2217bc5094
Create Date: 2026-03-14 15:04:55.471948

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cd44ad28524b'
down_revision: Union[str, None] = '4f2217bc5094'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    diarization_enum = sa.Enum('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', name='diarizationstatus')
    diarization_enum.create(op.get_bind(), checkfirst=True)
    op.add_column('transcriptions', sa.Column('diarization_status', diarization_enum, nullable=True))
    op.add_column('transcriptions', sa.Column('diarization_celery_task_id', sa.String(length=255), nullable=True))
    op.add_column('transcriptions', sa.Column('diarization_error', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('transcriptions', 'diarization_error')
    op.drop_column('transcriptions', 'diarization_celery_task_id')
    op.drop_column('transcriptions', 'diarization_status')
    sa.Enum(name='diarizationstatus').drop(op.get_bind(), checkfirst=True)
