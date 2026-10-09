"""Logistics partner profile (migration 009)."""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.infrastructure.postgres.base import Base


class LogisticsProfile(Base):
    __tablename__ = "logistics_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    company_name = Column(String(255), nullable=False)
    contact_name = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    vehicle_type = Column(String(50), nullable=True)
    vehicle_number = Column(String(30), nullable=True)
    service_city = Column(String(100), nullable=True)
    is_available = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    user = relationship("User")
