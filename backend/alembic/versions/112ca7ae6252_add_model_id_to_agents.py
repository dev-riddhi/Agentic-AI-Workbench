"""add model_id to agents

Revision ID: 112ca7ae6252
Revises: 6c678686eefa
Create Date: 2026-09-03 20:53:04.973775

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '112ca7ae6252'
down_revision: Union[str, Sequence[str], None] = '6c678686eefa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('agents', schema=None) as batch_op:
        batch_op.add_column(sa.Column('model_id', sa.Uuid(), nullable=False))
        batch_op.alter_column('model',
                   existing_type=sa.VARCHAR(length=100),
                   nullable=True)
        batch_op.create_index(batch_op.f('ix_agents_model_id'), ['model_id'], unique=False)
        batch_op.create_foreign_key('fk_agents_model_id_ai_models', 'ai_models', ['model_id'], ['id'])


def downgrade() -> None:
    with op.batch_alter_table('agents', schema=None) as batch_op:
        batch_op.drop_constraint('fk_agents_model_id_ai_models', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_agents_model_id'))
        batch_op.alter_column('model',
                   existing_type=sa.VARCHAR(length=100),
                   nullable=False)
        batch_op.drop_column('model_id')
