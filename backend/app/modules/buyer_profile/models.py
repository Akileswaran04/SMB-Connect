from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.infrastructure.postgres.base import Base


class BuyerProfile(Base):
    __tablename__ = "buyer_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)

    default_address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    preferred_payment_method = Column(String(50), nullable=True)
    is_business_buyer = Column(Boolean, nullable=False, default=False)
    company_name = Column(String(255), nullable=True)
    tax_id = Column(String(100), nullable=True)

    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    user = relationship("User", back_populates="buyer_profile")


class Address(Base):
    __tablename__ = "addresses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    buyer_id = Column(Integer, ForeignKey("buyer_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(100), nullable=False, default="Home")
    line1 = Column(String(255), nullable=False)
    line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), nullable=False, default="India")
    is_default = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    buyer = relationship("BuyerProfile")