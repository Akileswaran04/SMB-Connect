"""Platform-wide settings editable by admins (migration 009)."""
from datetime import datetime

from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import JSONB

from app.infrastructure.postgres.base import Base


class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    key = Column(String(80), primary_key=True)
    value = Column(JSONB, nullable=False)
    updated_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
