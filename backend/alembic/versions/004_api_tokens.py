"""Add api_tokens table for external integration OAuth (Gmail / Microsoft Graph).

Revision ID: 004_api_tokens
Revises: 003_payments_columns
Create Date: 2026-09-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "004_api_tokens"
down_revision = "003_payments_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the api_tokens table."""
    service_enum = postgresql.ENUM("gmail", "outlook", name="apiservice", create_type=False)
    service_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "api_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("service", service_enum, nullable=False),
        sa.Column("token_ref", sa.String(500), nullable=False, comment="Reference/identifier of the stored OAuth credential"),
        sa.Column("provider_account", sa.String(254), nullable=True, comment="Email address of the connected account"),
        sa.Column("scopes", sa.Text(), nullable=True, comment="Space-separated OAuth scopes"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "service", name="uq_api_tokens_user_service"),
    )
    op.create_index("ix_api_tokens_service", "api_tokens", ["service"])


def downgrade() -> None:
    """Drop the api_tokens table."""
    op.drop_index("ix_api_tokens_service", table_name="api_tokens")
    op.drop_table("api_tokens")
    postgresql.ENUM(name="apiservice").drop(op.get_bind(), checkfirst=True)