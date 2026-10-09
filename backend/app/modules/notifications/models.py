"""Notification model (migration 009)."""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB

from app.infrastructure.postgres.base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(String(1000), nullable=True)
    data = Column(JSONB, nullable=True)
    # Per-channel delivery outcome, e.g. {"in_app": "delivered", "sms": "logged"}.
    channels = Column(JSONB, nullable=True)
    # Makes one-off notifications (delay alert, reorder reminder) idempotent.
    dedupe_key = Column(String(120), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
