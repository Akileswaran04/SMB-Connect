"""Add payments table and missing columns for orders/analytics modules.

Revision ID: 003_payments_columns
Revises: 002_add_frontend_tables
Create Date: 2026-09-08 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "003_payments_columns"
down_revision = "002_add_frontend_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. payments table (mock ledger provider) ──
    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("provider", sa.String(50), nullable=False, server_default="mock"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("reference", sa.String(100), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_payments_order_id", "payments", ["order_id"])

    # ── 2. reviews.seller_reply (seller reply to a review) ──
    op.add_column("reviews", sa.Column("seller_reply", sa.String(500), nullable=True))

    # ── 3. analytics.response_time_avg (avg chat response time per seller) ──
    op.add_column("analytics", sa.Column("response_time_avg", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("analytics", "response_time_avg")
    op.drop_column("reviews", "seller_reply")
    op.drop_index("ix_payments_order_id", table_name="payments")
    op.drop_table("payments")