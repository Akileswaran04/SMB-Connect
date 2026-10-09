"""Add users.preferred_language — Phase 3 (voice/multilingual). Drives which
language a user's chat messages get translated into and which language the
voice assistant replies in.

Revision ID: 008_preferred_language
Revises: 007_negotiation_fulfillment
Create Date: 2026-09-22

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "008_preferred_language"
down_revision = "007_negotiation_fulfillment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("preferred_language", sa.String(10), nullable=False, server_default="en"),
    )


def downgrade() -> None:
    op.drop_column("users", "preferred_language")
