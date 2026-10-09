from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class UserRole(str, PyEnum):
    ADMIN = "admin"
    SELLER = "seller"
    BUYER = "buyer"


class SellerProfileStatus(str, PyEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    VERIFIED = "verified"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class VerificationType(str, PyEnum):
    BUSINESS_LICENSE = "business_license"
    TAX_DOCUMENT = "tax_document"
    IDENTITY = "identity"
    BANK_ACCOUNT = "bank_account"


class VerificationStatus(str, PyEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ProductStatus(str, PyEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    DELETED = "deleted"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True, index=True)
    full_name = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.BUYER)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    oauth_provider = Column(String(50), nullable=True)
    oauth_subject = Column(String(255), nullable=True)
    profile_picture_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    seller_profile = relationship("SellerProfile", back_populates="user", uselist=False)
    buyer_profile = relationship("BuyerProfile", back_populates="user", uselist=False)

    __table_args__ = (
        Index("idx_email", "email"),
        Index("idx_role", "role"),
        Index("idx_is_active", "is_active"),
    )


class SellerProfile(Base):
    __tablename__ = "seller_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    business_name = Column(String(255), nullable=False, index=True)
    business_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(String(500), nullable=True)
    address_line_1 = Column(String(255), nullable=False)
    address_line_2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=False)
    postal_code = Column(String(20), nullable=False)
    license_number = Column(String(100), unique=True, nullable=False, index=True)
    registration_number = Column(String(100), nullable=True)
    verification_status = Column(
        Enum(SellerProfileStatus), default=SellerProfileStatus.DRAFT, nullable=False, index=True
    )
    business_years = Column(Integer, nullable=True)
    employee_count = Column(Integer, nullable=True)
    annual_revenue = Column(String(50), nullable=True)
    certification = Column(Text, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verification_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="seller_profile")
    verifications = relationship("SellerVerification", back_populates="seller_profile", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="seller", cascade="all, delete-orphan")
    orders_as_seller = relationship("Order", foreign_keys="Order.seller_id", back_populates="seller")

    __table_args__ = (
        Index("idx_verification_status", "verification_status"),
        Index("idx_business_name", "business_name"),
        Index("idx_license_number", "license_number"),
    )


class SellerVerification(Base):
    __tablename__ = "seller_verifications"

    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id"), nullable=False, index=True)
    verification_type = Column(Enum(VerificationType), nullable=False)
    document_reference = Column(String(500), nullable=True)
    status = Column(Enum(VerificationStatus), default=VerificationStatus.PENDING, nullable=False)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    seller_profile = relationship("SellerProfile", back_populates="verifications")
    reviewed_by_user = relationship("User", foreign_keys=[reviewed_by])

    __table_args__ = (
        Index("idx_seller_id", "seller_id"),
        Index("idx_verification_type", "verification_type"),
        Index("idx_status", "status"),
        UniqueConstraint("seller_id", "verification_type", name="uq_seller_verification_type"),
    )


class BuyerProfile(Base):
    __tablename__ = "buyer_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    default_address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    preferred_payment_method = Column(String(50), nullable=True)
    is_business_buyer = Column(Boolean, default=False)
    company_name = Column(String(255), nullable=True)
    tax_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="buyer_profile")
    orders = relationship("Order", back_populates="buyer")
    reviews = relationship("Review", back_populates="buyer")

    __table_args__ = (
        Index("idx_user_id", "user_id"),
        Index("idx_is_business_buyer", "is_business_buyer"),
    )


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)
    category = Column(String(100), nullable=False, index=True)
    subcategory = Column(String(100), nullable=True)
    price = Column(Float, nullable=False)
    currency = Column(String(3), default="USD", nullable=False)
    stock_quantity = Column(Integer, default=0, nullable=False)
    sku = Column(String(100), nullable=True, index=True)
    status = Column(Enum(ProductStatus), default=ProductStatus.DRAFT, nullable=False, index=True)
    images_urls = Column(String(2000), nullable=True)
    tags = Column(String(500), nullable=True)
    rating = Column(Float, nullable=True)
    review_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    seller = relationship("SellerProfile", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")
    reviews = relationship("Review", back_populates="product")

    __table_args__ = (
        Index("idx_seller_id", "seller_id"),
        Index("idx_category", "category"),
        Index("idx_status", "status"),
        CheckConstraint("price >= 0", name="ck_product_price_positive"),
        CheckConstraint("stock_quantity >= 0", name="ck_product_stock_positive"),
    )


class OrderStatus(str, PyEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    RETURNED = "returned"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    buyer_id = Column(Integer, ForeignKey("buyer_profiles.id"), nullable=False, index=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id"), nullable=False, index=True)
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING, nullable=False, index=True)
    total_amount = Column(Float, nullable=False)
    currency = Column(String(3), default="USD", nullable=False)
    payment_method = Column(String(50), nullable=True)
    shipping_address = Column(String(500), nullable=True)
    delivery_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    buyer = relationship("BuyerProfile", back_populates="orders")
    seller = relationship("SellerProfile", foreign_keys=[seller_id], back_populates="orders_as_seller")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    transaction = relationship("Transaction", back_populates="order", uselist=False)

    __table_args__ = (
        Index("idx_buyer_id", "buyer_id"),
        Index("idx_seller_id", "seller_id"),
        Index("idx_status", "status"),
        Index("idx_order_number", "order_number"),
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")

    __table_args__ = (
        Index("idx_order_id", "order_id"),
        CheckConstraint("quantity > 0", name="ck_order_item_quantity_positive"),
    )


class TransactionStatus(str, PyEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, unique=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="USD", nullable=False)
    status = Column(Enum(TransactionStatus), default=TransactionStatus.PENDING, nullable=False)
    payment_method = Column(String(50), nullable=True)
    transaction_id = Column(String(100), unique=True, nullable=True)
    failure_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    order = relationship("Order", back_populates="transaction")

    __table_args__ = (
        Index("idx_status", "status"),
        Index("idx_transaction_id", "transaction_id"),
    )


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    buyer_id = Column(Integer, ForeignKey("buyer_profiles.id"), nullable=False, index=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    rating = Column(Integer, nullable=False)
    title = Column(String(255), nullable=True)
    comment = Column(Text, nullable=True)
    is_verified_purchase = Column(Boolean, default=False)
    helpful_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    product = relationship("Product", back_populates="reviews")
    buyer = relationship("BuyerProfile", back_populates="reviews")
    seller = relationship("SellerProfile", foreign_keys=[seller_id])

    __table_args__ = (
        Index("idx_product_id", "product_id"),
        Index("idx_buyer_id", "buyer_id"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_review_rating_range"),
    )


class TrustScore(Base):
    __tablename__ = "trust_scores"

    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id"), unique=True, nullable=False, index=True)
    overall_score = Column(Float, default=0.0)
    review_score = Column(Float, default=0.0)
    compliance_score = Column(Float, default=0.0)
    communication_score = Column(Float, default=0.0)
    return_rate = Column(Float, default=0.0)
    dispute_count = Column(Integer, default=0)
    successful_orders = Column(Integer, default=0)
    cancellation_rate = Column(Float, default=0.0)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_overall_score", "overall_score"),
        CheckConstraint("overall_score >= 0 AND overall_score <= 100", name="ck_trust_score_range"),
    )


class Analytics(Base):
    __tablename__ = "analytics"

    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id"), nullable=False, index=True)
    date = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    total_views = Column(Integer, default=0)
    total_clicks = Column(Integer, default=0)
    total_sales = Column(Float, default=0.0)
    total_orders = Column(Integer, default=0)
    total_revenue = Column(Float, default=0.0)
    average_order_value = Column(Float, default=0.0)
    conversion_rate = Column(Float, default=0.0)
    visitor_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_seller_id_date", "seller_id", "date"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(Integer, nullable=True)
    changes = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    status = Column(String(20), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    __table_args__ = (
        Index("idx_user_id", "user_id"),
        Index("idx_action", "action"),
        Index("idx_created_at", "created_at"),
    )
