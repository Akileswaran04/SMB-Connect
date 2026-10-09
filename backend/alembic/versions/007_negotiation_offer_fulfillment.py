"""Track which order (if any) fulfilled an accepted negotiation offer, so an
accepted offer can't be checked out twice at the negotiated price.

Revision ID: 007_negotiation_fulfillment
Revises: 006_negotiation
Create Date: 2026-09-22

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "007_negotiation_fulfillment"
down_revision = "006_negotiation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "negotiation_offers",
        sa.Column("fulfilled_order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("negotiation_offers", "fulfilled_order_id")
