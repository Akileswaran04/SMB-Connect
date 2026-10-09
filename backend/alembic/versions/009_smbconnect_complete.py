"""SMBConnect completion — logistics, shipments, notifications, disputes,
variants/inventory, pricing, personalisation, admin moderation.

Additive only: new tables and nullable/defaulted columns. Currency moves to
INR (sellers have always entered prices in rupees; the USD label was wrong).

Revision ID: 009_smbconnect_complete
Revises: 008_preferred_language
Create Date: 2026-09-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "009_smbconnect_complete"
down_revision = "008_preferred_language"
branch_labels = None
depends_on = None

JSONB = postgresql.JSONB


def _ts(name, nullable=False):
    return sa.Column(name, sa.DateTime(), nullable=nullable, server_default=None if nullable else sa.text("now()"))


def upgrade() -> None:
    # ── Enum values ──
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'logistics'")
    op.execute("ALTER TYPE verificationstatus ADD VALUE IF NOT EXISTS 'info_requested'")

    # ── Users / profiles ──
    op.create_table(
        "logistics_profiles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("contact_name", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("vehicle_type", sa.String(50), nullable=True),
        sa.Column("vehicle_number", sa.String(30), nullable=True),
        sa.Column("service_city", sa.String(100), nullable=True),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        _ts("created_at"),
        _ts("updated_at"),
    )

    op.add_column("buyer_profiles", sa.Column("preferences", JSONB(), nullable=True))

    for name, col in [
        ("owner_name", sa.String(255)),
        ("bank_account_holder", sa.String(255)),
        ("bank_account_last4", sa.String(4)),
        ("bank_ifsc", sa.String(20)),
        ("upi_id", sa.String(100)),
    ]:
        op.add_column("seller_profiles", sa.Column(name, col, nullable=True))

    op.add_column("seller_verifications", sa.Column("admin_note", sa.Text(), nullable=True))

    # ── Catalogue ──
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        _ts("created_at"),
    )

    # products.sku and products.status (productstatus enum: draft/published/
    # archived/deleted) already exist from 001 but were never used; every
    # product is live in the catalogue today, so mark them published.
    op.execute("UPDATE products SET status = 'published' WHERE status = 'draft'")
    op.alter_column("products", "status", server_default="published")
    for col in [
        sa.Column("sale_price", sa.Float(), nullable=True),
        sa.Column("promo_price", sa.Float(), nullable=True),
        sa.Column("promo_ends_at", sa.DateTime(), nullable=True),
        sa.Column("bulk_pricing", JSONB(), nullable=True),
        sa.Column("delivery_days", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("express_available", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("return_days", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("return_policy", sa.String(500), nullable=True),
        sa.Column("specifications", JSONB(), nullable=True),
        sa.Column("images", JSONB(), nullable=True),
        sa.Column("reserved_stock", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("incoming_stock", sa.Integer(), nullable=False, server_default="0"),
    ]:
        op.add_column("products", col)
    op.create_index("ix_products_seller_sku", "products", ["seller_id", "sku"])

    op.create_table(
        "product_variants",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("sku", sa.String(64), nullable=True),
        sa.Column("size", sa.String(30), nullable=True),
        sa.Column("color", sa.String(40), nullable=True),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("stock", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reserved_stock", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("incoming_stock", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        _ts("created_at"),
        sa.CheckConstraint("stock >= 0", name="ck_variant_stock_nonneg"),
        sa.CheckConstraint("reserved_stock >= 0", name="ck_variant_reserved_nonneg"),
    )

    op.create_table(
        "inventory_transactions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("variant_id", sa.Integer(), sa.ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("stock_change", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reserved_change", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reason", sa.String(40), nullable=False),
        sa.Column("note", sa.String(255), nullable=True),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        _ts("created_at"),
    )

    op.create_table(
        "product_reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("reporter_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("resolution_note", sa.String(500), nullable=True),
        _ts("created_at"),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
    )

    # ── Cart ──
    op.add_column("cart_items", sa.Column("variant_id", sa.Integer(), sa.ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=True))
    op.add_column("cart_items", sa.Column("offer_id", sa.Integer(), sa.ForeignKey("negotiation_offers.id", ondelete="SET NULL"), nullable=True))
    op.drop_constraint("uq_cart_items_cart_product", "cart_items", type_="unique")
    op.execute(
        "CREATE UNIQUE INDEX uq_cart_items_line ON cart_items (cart_id, product_id, COALESCE(variant_id, 0))"
    )

    # ── Orders / payments ──
    for col in [
        sa.Column("subtotal", sa.Float(), nullable=True),
        sa.Column("discount_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("delivery_charge", sa.Float(), nullable=False, server_default="0"),
        sa.Column("platform_fee", sa.Float(), nullable=False, server_default="0"),
        sa.Column("delivery_option", sa.String(20), nullable=False, server_default="standard"),
        sa.Column("address_id", sa.Integer(), sa.ForeignKey("addresses.id", ondelete="SET NULL"), nullable=True),
        sa.Column("cancel_reason", sa.String(500), nullable=True),
        sa.Column("return_reason", sa.String(500), nullable=True),
    ]:
        op.add_column("orders", col)
    for col in [
        sa.Column("variant_id", sa.Integer(), sa.ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("product_name", sa.String(255), nullable=True),
        sa.Column("variant_label", sa.String(100), nullable=True),
        sa.Column("listed_unit_price", sa.Float(), nullable=True),
        sa.Column("offer_id", sa.Integer(), nullable=True),
    ]:
        op.add_column("order_items", col)

    op.add_column("payments", sa.Column("settlement_status", sa.String(20), nullable=False, server_default="unsettled"))
    op.add_column("payments", sa.Column("settled_at", sa.DateTime(), nullable=True))

    for table in ("products", "orders", "payments", "transactions"):
        op.alter_column(table, "currency", server_default="INR")
        op.execute(f"UPDATE {table} SET currency = 'INR' WHERE currency = 'USD'")
    op.execute("UPDATE orders SET subtotal = total_amount WHERE subtotal IS NULL")

    # ── Shipments ──
    op.create_table(
        "shipments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("shipment_number", sa.String(40), nullable=False, unique=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("seller_id", sa.Integer(), sa.ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("buyer_id", sa.Integer(), sa.ForeignKey("buyer_profiles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("logistics_partner_id", sa.Integer(), sa.ForeignKey("logistics_profiles.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="created"),
        sa.Column("package_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("length_cm", sa.Float(), nullable=True),
        sa.Column("width_cm", sa.Float(), nullable=True),
        sa.Column("height_cm", sa.Float(), nullable=True),
        sa.Column("pickup_address", sa.String(500), nullable=True),
        sa.Column("delivery_address", sa.String(500), nullable=True),
        sa.Column("scheduled_pickup_at", sa.DateTime(), nullable=True),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.Column("picked_up_at", sa.DateTime(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(), nullable=True),
        sa.Column("expected_delivery_at", sa.DateTime(), nullable=True),
        sa.Column("current_location", sa.String(255), nullable=True),
        sa.Column("label_generated_at", sa.DateTime(), nullable=True),
        sa.Column("delivery_otp_hash", sa.String(255), nullable=True),
        sa.Column("pod_otp_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("pod_signature_name", sa.String(255), nullable=True),
        sa.Column("pod_photo_url", sa.Text(), nullable=True),
        sa.Column("pod_recorded_at", sa.DateTime(), nullable=True),
        sa.Column("failure_reason", sa.String(500), nullable=True),
        sa.Column("delivery_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("delay_notified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        _ts("created_at"),
        _ts("updated_at"),
    )
    op.create_table(
        "shipment_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("shipment_id", sa.Integer(), sa.ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("actor_role", sa.String(20), nullable=True),
        _ts("created_at"),
    )

    # ── Notifications / disputes ──
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.String(1000), nullable=True),
        sa.Column("data", JSONB(), nullable=True),
        sa.Column("channels", JSONB(), nullable=True),
        sa.Column("dedupe_key", sa.String(120), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        _ts("created_at"),
    )
    op.create_index("ix_notifications_user_unread", "notifications", ["user_id", "is_read"])
    op.create_index("uq_notifications_dedupe", "notifications", ["user_id", "dedupe_key"], unique=True,
                    postgresql_where=sa.text("dedupe_key IS NOT NULL"))

    op.create_table(
        "disputes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("raised_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("raised_by_role", sa.String(20), nullable=False),
        sa.Column("reason", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column("resolved_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        _ts("created_at"),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
    )

    # ── Platform settings / AI logs ──
    op.create_table(
        "platform_settings",
        sa.Column("key", sa.String(80), primary_key=True),
        sa.Column("value", JSONB(), nullable=False),
        _ts("updated_at"),
    )
    op.create_table(
        "recommendation_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("query", sa.String(500), nullable=True),
        sa.Column("extraction", JSONB(), nullable=True),
        sa.Column("product_ids", JSONB(), nullable=True),
        _ts("created_at"),
    )
    op.create_table(
        "voice_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("language", sa.String(20), nullable=True),
        sa.Column("transcript", sa.String(1000), nullable=True),
        sa.Column("intent", sa.String(40), nullable=True),
        sa.Column("reply", sa.String(2000), nullable=True),
        _ts("created_at"),
    )


def downgrade() -> None:
    for table in [
        "voice_sessions", "recommendation_logs", "platform_settings", "disputes",
        "notifications", "shipment_events", "shipments",
    ]:
        op.drop_table(table)
    for name in ["return_reason", "cancel_reason", "address_id", "delivery_option", "platform_fee",
                 "delivery_charge", "discount_amount", "subtotal"]:
        op.drop_column("orders", name)
    for name in ["offer_id", "listed_unit_price", "variant_label", "product_name", "variant_id"]:
        op.drop_column("order_items", name)
    op.drop_column("payments", "settled_at")
    op.drop_column("payments", "settlement_status")
    op.execute("DROP INDEX IF EXISTS uq_cart_items_line")
    op.drop_column("cart_items", "offer_id")
    op.drop_column("cart_items", "variant_id")
    op.create_unique_constraint("uq_cart_items_cart_product", "cart_items", ["cart_id", "product_id"])
    op.drop_table("product_reports")
    op.drop_table("inventory_transactions")
    op.drop_table("product_variants")
    op.drop_index("ix_products_seller_sku", table_name="products")
    for name in ["incoming_stock", "reserved_stock", "images", "specifications", "return_policy", "return_days",
                 "express_available", "delivery_days", "bulk_pricing", "promo_ends_at", "promo_price",
                 "sale_price"]:
        op.drop_column("products", name)
    op.drop_table("categories")
    op.drop_column("seller_verifications", "admin_note")
    for name in ["upi_id", "bank_ifsc", "bank_account_last4", "bank_account_holder", "owner_name"]:
        op.drop_column("seller_profiles", name)
    op.drop_column("buyer_profiles", "preferences")
    op.drop_table("logistics_profiles")
    # Enum values added in upgrade() cannot be removed in PostgreSQL; left in place.
