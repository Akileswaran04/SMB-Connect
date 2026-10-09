"""Add frontend data tables: fix products, conversations, messages, customers, ai_interactions.

Revision ID: 002_add_frontend_tables
Revises: 001_initial_schema
Create Date: 2026-08-30 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "002_add_frontend_tables"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Fix products table: add missing columns ──
    op.add_column("products", sa.Column("image_url", sa.Text(), nullable=True))
    op.add_column("products", sa.Column("stock", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("products", sa.Column("low_stock_threshold", sa.Integer(), nullable=False, server_default="5"))
    op.add_column("products", sa.Column("likes", sa.Integer(), nullable=False, server_default="0"))

    # ── 2. Create conversations table ──
    op.create_table(
        "conversations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("seller_id", sa.Integer(), sa.ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_name", sa.String(255), nullable=False),
        sa.Column("customer_phone", sa.String(20), nullable=True),
        sa.Column("customer_email", sa.String(254), nullable=True),
        sa.Column("last_message", sa.Text(), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unread_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("order_tag", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_conversations_seller", "conversations", ["seller_id"])

    # ── 3. Create messages table ──
    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("conversation_id", sa.Integer(), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_type", sa.String(20), nullable=False),
        sa.Column("sender_name", sa.String(255), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("is_ai_generated", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("order_data", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_messages_conversation", "messages", ["conversation_id"])
    op.create_index("ix_messages_created", "messages", ["created_at"])

    # ── 4. Create customers table ──
    op.create_table(
        "customers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("seller_id", sa.Integer(), sa.ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(254), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("total_orders", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_order_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_customers_seller", "customers", ["seller_id"])

    # ── 5. Create ai_interactions table ──
    op.create_table(
        "ai_interactions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("conversation_id", sa.Integer(), sa.ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("seller_id", sa.Integer(), sa.ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message_text", sa.Text(), nullable=False),
        sa.Column("emotion", sa.String(50), nullable=True),
        sa.Column("strategy", sa.String(50), nullable=True),
        sa.Column("lead_score", sa.Integer(), nullable=True),
        sa.Column("ai_response", sa.Text(), nullable=True),
        sa.Column("was_sent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("was_edited", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ai_interactions_seller", "ai_interactions", ["seller_id"])
    op.create_index("ix_ai_interactions_created", "ai_interactions", ["created_at"])


def downgrade() -> None:
    op.drop_table("ai_interactions")
    op.drop_table("customers")
    op.drop_table("messages")
    op.drop_table("conversations")
    op.drop_column("products", "likes")
    op.drop_column("products", "low_stock_threshold")
    op.drop_column("products", "stock")
    op.drop_column("products", "image_url")
