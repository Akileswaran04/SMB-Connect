"""Initial schema setup - Create all base tables.

Revision ID: 001_initial_schema
Revises: 
Create Date: 2024-08-30 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create initial schema."""
    # Create enums
    userRole_enum = postgresql.ENUM("admin", "seller", "buyer", name="userrole", create_type=False)
    userRole_enum.create(op.get_bind(), checkfirst=True)

    sellerProfileStatus_enum = postgresql.ENUM(
        "draft", "submitted", "under_review", "verified", "rejected", "suspended",
        name="sellerprofilestatus", create_type=False,
    )
    sellerProfileStatus_enum.create(op.get_bind(), checkfirst=True)

    verificationType_enum = postgresql.ENUM(
        "business_license", "tax_document", "identity", "bank_account", name="verificationtype", create_type=False
    )
    verificationType_enum.create(op.get_bind(), checkfirst=True)

    verificationStatus_enum = postgresql.ENUM("pending", "approved", "rejected", name="verificationstatus", create_type=False)
    verificationStatus_enum.create(op.get_bind(), checkfirst=True)

    productStatus_enum = postgresql.ENUM("draft", "published", "archived", "deleted", name="productstatus", create_type=False)
    productStatus_enum.create(op.get_bind(), checkfirst=True)

    orderStatus_enum = postgresql.ENUM(
        "pending", "confirmed", "shipped", "delivered", "cancelled", "returned", name="orderstatus", create_type=False
    )
    orderStatus_enum.create(op.get_bind(), checkfirst=True)

    transactionStatus_enum = postgresql.ENUM(
        "pending", "completed", "failed", "refunded", name="transactionstatus", create_type=False
    )
    transactionStatus_enum.create(op.get_bind(), checkfirst=True)

    # Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", userRole_enum, nullable=False, server_default="buyer"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("oauth_provider", sa.String(length=50), nullable=True),
        sa.Column("oauth_subject", sa.String(length=255), nullable=True),
        sa.Column("profile_picture_url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("phone"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_is_active", "users", ["is_active"])

    # Create seller_profiles table
    op.create_table(
        "seller_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("business_name", sa.String(length=255), nullable=False),
        sa.Column("business_type", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("address_line_1", sa.String(length=255), nullable=True),
        sa.Column("address_line_2", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("state", sa.String(length=100), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True, default="India"),
        sa.Column("postal_code", sa.String(length=20), nullable=True),
        sa.Column("license_number", sa.String(length=100), nullable=True),
        sa.Column("verification_status", sellerProfileStatus_enum, nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_seller_profiles_users"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_seller_profiles_verification_status", "seller_profiles", ["verification_status"])
    op.create_index("ix_seller_profiles_business_name", "seller_profiles", ["business_name"])

    # Create seller_verifications table
    op.create_table(
        "seller_verifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("seller_id", sa.Integer(), nullable=False),
        sa.Column("verification_type", verificationType_enum, nullable=False),
        sa.Column("document_reference", sa.String(length=500), nullable=True),
        sa.Column("status", verificationStatus_enum, nullable=False, server_default="pending"),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["seller_id"], ["seller_profiles.id"], name="fk_seller_verifications_seller"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], name="fk_seller_verifications_reviewer"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("seller_id", "verification_type", name="uq_seller_verification_type"),
    )
    op.create_index("ix_seller_verifications_seller_id", "seller_verifications", ["seller_id"])
    op.create_index("ix_seller_verifications_type", "seller_verifications", ["verification_type"])
    op.create_index("ix_seller_verifications_status", "seller_verifications", ["status"])

    # Create buyer_profiles table
    op.create_table(
        "buyer_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("default_address", sa.String(length=500), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("postal_code", sa.String(length=20), nullable=True),
        sa.Column("preferred_payment_method", sa.String(length=50), nullable=True),
        sa.Column("is_business_buyer", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("company_name", sa.String(length=255), nullable=True),
        sa.Column("tax_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_buyer_profiles_users"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_buyer_profiles_user_id", "buyer_profiles", ["user_id"])

    # Create products table
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("seller_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("subcategory", sa.String(length=100), nullable=True),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("stock_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sku", sa.String(length=100), nullable=True),
        sa.Column("status", productStatus_enum, nullable=False, server_default="draft"),
        sa.Column("images_urls", sa.String(length=2000), nullable=True),
        sa.Column("tags", sa.String(length=500), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("review_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("price >= 0", name="ck_product_price_positive"),
        sa.CheckConstraint("stock_quantity >= 0", name="ck_product_stock_positive"),
        sa.ForeignKeyConstraint(["seller_id"], ["seller_profiles.id"], name="fk_products_seller"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_products_seller_id", "products", ["seller_id"])
    op.create_index("ix_products_category", "products", ["category"])
    op.create_index("ix_products_status", "products", ["status"])

    # Create orders table
    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_number", sa.String(length=50), nullable=False),
        sa.Column("buyer_id", sa.Integer(), nullable=False),
        sa.Column("seller_id", sa.Integer(), nullable=False),
        sa.Column("status", orderStatus_enum, nullable=False, server_default="pending"),
        sa.Column("total_amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("payment_method", sa.String(length=50), nullable=True),
        sa.Column("shipping_address", sa.String(length=500), nullable=True),
        sa.Column("delivery_date", sa.DateTime(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["buyer_id"], ["buyer_profiles.id"], name="fk_orders_buyer"),
        sa.ForeignKeyConstraint(["seller_id"], ["seller_profiles.id"], name="fk_orders_seller"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_number"),
    )
    op.create_index("ix_orders_order_number", "orders", ["order_number"])
    op.create_index("ix_orders_buyer_id", "orders", ["buyer_id"])
    op.create_index("ix_orders_seller_id", "orders", ["seller_id"])
    op.create_index("ix_orders_status", "orders", ["status"])

    # Create order_items table
    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Float(), nullable=False),
        sa.Column("total_price", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_order_item_quantity_positive"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], name="fk_order_items_order"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name="fk_order_items_product"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"])

    # Create transactions table
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("status", transactionStatus_enum, nullable=False, server_default="pending"),
        sa.Column("payment_method", sa.String(length=50), nullable=True),
        sa.Column("transaction_id", sa.String(length=100), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], name="fk_transactions_order"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_id"),
        sa.UniqueConstraint("transaction_id"),
    )
    op.create_index("ix_transactions_status", "transactions", ["status"])
    op.create_index("ix_transactions_transaction_id", "transactions", ["transaction_id"])

    # Create reviews table
    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("buyer_id", sa.Integer(), nullable=False),
        sa.Column("seller_id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("is_verified_purchase", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("helpful_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_review_rating_range"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name="fk_reviews_product"),
        sa.ForeignKeyConstraint(["buyer_id"], ["buyer_profiles.id"], name="fk_reviews_buyer"),
        sa.ForeignKeyConstraint(["seller_id"], ["seller_profiles.id"], name="fk_reviews_seller"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], name="fk_reviews_order"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reviews_product_id", "reviews", ["product_id"])
    op.create_index("ix_reviews_buyer_id", "reviews", ["buyer_id"])

    # Create trust_scores table
    op.create_table(
        "trust_scores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("seller_id", sa.Integer(), nullable=False),
        sa.Column("overall_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("review_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("compliance_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("communication_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("return_rate", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("dispute_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("successful_orders", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cancellation_rate", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("last_updated", sa.DateTime(), nullable=False),
        sa.CheckConstraint("overall_score >= 0 AND overall_score <= 100", name="ck_trust_score_range"),
        sa.ForeignKeyConstraint(["seller_id"], ["seller_profiles.id"], name="fk_trust_scores_seller"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("seller_id"),
    )
    op.create_index("ix_trust_scores_overall_score", "trust_scores", ["overall_score"])

    # Create analytics table
    op.create_table(
        "analytics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("seller_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.DateTime(), nullable=False),
        sa.Column("total_views", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_clicks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_sales", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("total_orders", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_revenue", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("average_order_value", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("conversion_rate", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("visitor_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["seller_id"], ["seller_profiles.id"], name="fk_analytics_seller"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_analytics_seller_date", "analytics", ["seller_id", "date"])

    # Create audit_logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("resource_type", sa.String(length=100), nullable=False),
        sa.Column("resource_id", sa.Integer(), nullable=True),
        sa.Column("changes", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_audit_logs_user"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("audit_logs")
    op.drop_table("analytics")
    op.drop_table("trust_scores")
    op.drop_table("reviews")
    op.drop_table("transactions")
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_table("products")
    op.drop_table("buyer_profiles")
    op.drop_table("seller_verifications")
    op.drop_table("seller_profiles")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS userrole")
    op.execute("DROP TYPE IF EXISTS sellerprofilestatus")
    op.execute("DROP TYPE IF EXISTS verificationtype")
    op.execute("DROP TYPE IF EXISTS verificationstatus")
    op.execute("DROP TYPE IF EXISTS productstatus")
    op.execute("DROP TYPE IF EXISTS orderstatus")
    op.execute("DROP TYPE IF EXISTS transactionstatus")
