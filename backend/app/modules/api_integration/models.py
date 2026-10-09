from datetime import datetime

from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey, Integer, Text,
    UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM

from app.infrastructure.postgres.base import Base

apiservice_enum = PG_ENUM("gmail", "outlook", name="apiservice", create_type=False)


class ApiToken(Base):
    __tablename__ = "api_tokens"
    __table_args__ = (
        UniqueConstraint("user_id", "service", name="uq_api_tokens_user_service"),
        Index("ix_api_tokens_service", "service"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    service = Column(apiservice_enum, nullable=False)
    token_ref = Column(String(500), nullable=False)
    provider_account = Column(String(254), nullable=True)
    scopes = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)