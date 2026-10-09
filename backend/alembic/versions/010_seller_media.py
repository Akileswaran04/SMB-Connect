"""Seller avatar, cover image and verification documents (stored inline as
data URLs until object storage is wired up).

Revision ID: 010_seller_media
Revises: 009_smbconnect_complete
Create Date: 2026-10-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "010_seller_media"
down_revision = "009_smbconnect_complete"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("seller_profiles", sa.Column("avatar_image", sa.Text(), nullable=True))
    op.add_column("seller_profiles", sa.Column("cover_image", sa.Text(), nullable=True))
    op.add_column("seller_profiles", sa.Column("documents", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("seller_profiles", "documents")
    op.drop_column("seller_profiles", "cover_image")
    op.drop_column("seller_profiles", "avatar_image")
