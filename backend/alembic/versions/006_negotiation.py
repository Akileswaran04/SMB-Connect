"""Add negotiation_rules and negotiation_offers (Phase 2 of the SMBConnect
build — see plan). A seller opts a product into negotiation and sets bounds;
buyers propose offers within an AI-suggested range, seller accepts/rejects/
counters. Never auto-committed — every offer needs explicit human approval
on the sending side (see negotiation service).

Revision ID: 006_negotiation
Revises: 005_cart_checkout_tracking
Create Date: 2026-09-22

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "006_negotiation"
down_revision = "005_cart_checkout_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    offered_by_enum = postgresql.ENUM("buyer", "seller", name="negotiationofferedby", create_type=False)
    offered_by_enum.create(op.get_bind(), checkfirst=True)
    offer_status_enum = postgresql.ENUM(
        "pending", "accepted", "rejected", "countered", "expired",
        name="negotiationofferstatus", create_type=False,
    )
    offer_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "negotiation_rules",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("min_price", sa.Float(), nullable=False),
        sa.Column("auto_accept_threshold", sa.Float(), nullable=True),
        sa.Column("counter_offer_range_pct", sa.Float(), nullable=False, server_default="10"),
        sa.Column("max_rounds", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("quantity_discount_rules", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("min_price >= 0", name="ck_negotiation_rules_min_price_nonneg"),
    )

    op.create_table(
        "negotiation_offers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("buyer_id", sa.Integer(), sa.ForeignKey("buyer_profiles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("seller_id", sa.Integer(), sa.ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("round", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("offered_price", sa.Float(), nullable=False),
        sa.Column("offered_by", offered_by_enum, nullable=False),
        sa.Column("status", offer_status_enum, nullable=False, server_default="pending"),
        sa.Column("message", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("offered_price >= 0", name="ck_negotiation_offers_price_nonneg"),
    )
    op.create_index("ix_negotiation_offers_thread", "negotiation_offers", ["product_id", "buyer_id"])


def downgrade() -> None:
    op.drop_index("ix_negotiation_offers_thread", table_name="negotiation_offers")
    op.drop_table("negotiation_offers")
    op.drop_table("negotiation_rules")
    postgresql.ENUM(name="negotiationofferstatus").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="negotiationofferedby").drop(op.get_bind(), checkfirst=True)
