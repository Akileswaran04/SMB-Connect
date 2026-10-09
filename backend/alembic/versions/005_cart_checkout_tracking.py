"""Add cart/cart_items/addresses/tracking_events, expand orderstatus enum.

Phase 1 of the SMBConnect build: cart + checkout + a full order tracking
timeline (see plan). Additive only — existing orderstatus values keep
working, new ones are appended.

Revision ID: 005_cart_checkout_tracking
Revises: 004_api_tokens
Create Date: 2026-09-22

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "005_cart_checkout_tracking"
down_revision = "004_api_tokens"
branch_labels = None
depends_on = None

NEW_ORDER_STATUSES = [
    "created", "payment_pending", "paid", "seller_confirmed", "processing",
    "packed", "ready_for_pickup", "picked_up", "in_transit",
    "out_for_delivery", "return_requested", "refunded", "delivery_failed",
]


def upgrade() -> None:
    # ── Expand orderstatus enum (additive; existing values untouched) ──
    for value in NEW_ORDER_STATUSES:
        op.execute(f"ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS '{value}'")

    # ── addresses ──
    op.create_table(
        "addresses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("buyer_id", sa.Integer(), sa.ForeignKey("buyer_profiles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("label", sa.String(100), nullable=False, server_default="Home"),
        sa.Column("line1", sa.String(255), nullable=False),
        sa.Column("line2", sa.String(255), nullable=True),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("postal_code", sa.String(20), nullable=True),
        sa.Column("country", sa.String(100), nullable=False, server_default="India"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # ── carts / cart_items ──
    op.create_table(
        "carts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("buyer_id", sa.Integer(), sa.ForeignKey("buyer_profiles.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_table(
        "cart_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("cart_id", sa.Integer(), sa.ForeignKey("carts.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("cart_id", "product_id", name="uq_cart_items_cart_product"),
        sa.CheckConstraint("quantity > 0", name="ck_cart_item_quantity_positive"),
    )

    # ── tracking_events ──
    op.create_table(
        "tracking_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("actor_role", sa.String(20), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("tracking_events")
    op.drop_table("cart_items")
    op.drop_table("carts")
    op.drop_table("addresses")
    # Postgres does not support removing enum values — new orderstatus
    # values are left in place on downgrade (harmless, unused).
