from datetime import datetime

from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM
from sqlalchemy.orm import relationship

from app.infrastructure.postgres.base import Base


def _pg_enum(name, values):
    return PG_ENUM(*values, name=name, create_type=False)


orderstatus_enum = _pg_enum("orderstatus", [
    "pending", "confirmed", "shipped", "delivered", "cancelled", "returned",
    "created", "payment_pending", "paid", "seller_confirmed", "processing",
    "packed", "ready_for_pickup", "picked_up", "in_transit",
    "out_for_delivery", "return_requested", "refunded", "delivery_failed",
])


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_number = Column(String(50), nullable=False, unique=True)
    buyer_id = Column(Integer, ForeignKey("buyer_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(orderstatus_enum, nullable=False, default="pending", index=True)
    total_amount = Column(Float, nullable=False)
    currency = Column(String(3), nullable=False, default="INR")
    payment_method = Column(String(50), nullable=True)
    shipping_address = Column(String(500), nullable=True)
    address_id = Column(Integer, ForeignKey("addresses.id", ondelete="SET NULL"), nullable=True)
    # Expected delivery date, set at checkout from the delivery option.
    delivery_date = Column(DateTime(), nullable=True)
    delivery_option = Column(String(20), nullable=False, default="standard")
    subtotal = Column(Float, nullable=True)
    discount_amount = Column(Float, nullable=False, default=0.0)
    delivery_charge = Column(Float, nullable=False, default=0.0)
    # Charged to the seller at settlement, never to the buyer.
    platform_fee = Column(Float, nullable=False, default=0.0)
    cancel_reason = Column(String(500), nullable=True)
    return_reason = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    buyer = relationship("BuyerProfile", foreign_keys=[buyer_id])
    seller = relationship("SellerProfile", foreign_keys=[seller_id])


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(Integer, ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)
    # Snapshots so the order still reads correctly if the product changes later.
    product_name = Column(String(255), nullable=True)
    variant_label = Column(String(100), nullable=True)
    listed_unit_price = Column(Float, nullable=True)
    offer_id = Column(Integer, nullable=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_order_item_quantity_positive"),
    )

    order = relationship("Order", back_populates="items")
    product = relationship("Product")
    variant = relationship("ProductVariant")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    buyer_id = Column(Integer, ForeignKey("buyer_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    rating = Column(Integer, nullable=False)
    title = Column(String(255), nullable=True)
    comment = Column(Text, nullable=True)
    seller_reply = Column(String(500), nullable=True)
    is_verified_purchase = Column(Boolean, nullable=False, default=False)
    helpful_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_review_rating_range"),
    )


class TrackingEvent(Base):
    __tablename__ = "tracking_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(30), nullable=False)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_role = Column(String(20), nullable=True)
    location = Column(String(255), nullable=True)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    order = relationship("Order")