from datetime import datetime

from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, ForeignKey, Integer, Float,
    CheckConstraint, Index
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.infrastructure.postgres.base import Base
from app.shared.enums import SellerProfileStatus, UserRole, VerificationType
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM


def _pg_enum(name, values):
    return PG_ENUM(*values, name=name, create_type=False)


userrole_enum = _pg_enum("userrole", ["admin", "seller", "buyer"])
sellerprofilestatus_enum = _pg_enum("sellerprofilestatus", ["draft", "submitted", "under_review", "verified", "rejected", "suspended"])
verificationtype_enum = _pg_enum("verificationtype", ["business_license", "tax_document", "identity", "bank_account"])
verificationstatus_enum = _pg_enum("verificationstatus", ["pending", "approved", "rejected"])


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True, index=True)
    full_name = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(userrole_enum, nullable=False, default="seller")
    is_active = Column(Boolean, nullable=False, default=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    preferred_language = Column(String(10), nullable=False, default="en")
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    seller_profile = relationship("SellerProfile", back_populates="user", uselist=False)
    buyer_profile = relationship("BuyerProfile", back_populates="user", uselist=False)


class SellerProfile(Base):
    __tablename__ = "seller_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    business_name = Column(String(255), nullable=False)
    business_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(String(500), nullable=True)

    address_line_1 = Column(String(255), nullable=True)
    address_line_2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True, default="India")
    postal_code = Column(String(20), nullable=True)

    license_number = Column(String(100), nullable=True)
    verification_status = Column(sellerprofilestatus_enum, nullable=False, default="draft")

    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    user = relationship("User", back_populates="seller_profile")
    verifications = relationship("SellerVerification", back_populates="seller", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="seller", cascade="all, delete-orphan")


class SellerVerification(Base):
    __tablename__ = "seller_verifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False, index=True)

    verification_type = Column(verificationtype_enum, nullable=False)
    document_reference = Column(String(500), nullable=True)
    status = Column(verificationstatus_enum, nullable=False, default="pending")
    reviewed_by = Column(Integer, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    seller = relationship("SellerProfile", back_populates="verifications")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, default="general")
    price = Column(Float, nullable=False)
    image_url = Column(Text, nullable=True)
    stock = Column(Integer, nullable=False, default=0)
    low_stock_threshold = Column(Integer, nullable=False, default=5)
    likes = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    seller = relationship("SellerProfile", back_populates="products")


class ProductReview(Base):
    __tablename__ = "product_reviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_name = Column(String(255), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    seller_reply = Column(Text, nullable=True)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_name = Column(String(255), nullable=False)
    customer_phone = Column(String(20), nullable=True)
    customer_email = Column(String(254), nullable=True)
    last_message = Column(Text, nullable=True)
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    unread_count = Column(Integer, nullable=False, default=0)
    order_tag = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_type = Column(String(20), nullable=False)
    sender_name = Column(String(255), nullable=True)
    text = Column(Text, nullable=False)
    is_ai_generated = Column(Boolean, nullable=False, default=False)
    order_data = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(254), nullable=True)
    phone = Column(String(20), nullable=True)
    total_orders = Column(Integer, nullable=False, default=0)
    last_order_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class AIInteraction(Base):
    __tablename__ = "ai_interactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    message_text = Column(Text, nullable=False)
    emotion = Column(String(50), nullable=True)
    strategy = Column(String(50), nullable=True)
    lead_score = Column(Integer, nullable=True)
    ai_response = Column(Text, nullable=True)
    was_sent = Column(Boolean, nullable=False, default=False)
    was_edited = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
