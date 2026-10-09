"""
Cart models — carts, cart_items (PostgreSQL, migrations 005/009).

One cart per buyer (unique constraint), items keyed by (cart_id, product_id,
variant) — a unique index in 009 — so adding an already-present line bumps
quantity instead of duplicating. An accepted negotiation offer can back a
line (offer_id) so it is charged at the negotiated price.
"""
from datetime import datetime

from sqlalchemy import Column, Integer, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship

from app.infrastructure.postgres.base import Base


class Cart(Base):
    """A buyer's cart — created lazily on first add-to-cart."""
    __tablename__ = "carts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    buyer_id = Column(Integer, ForeignKey("buyer_profiles.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")
    buyer = relationship("BuyerProfile")


class CartItem(Base):
    """A product line in a cart."""
    __tablename__ = "cart_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cart_id = Column(Integer, ForeignKey("carts.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=True)
    offer_id = Column(Integer, ForeignKey("negotiation_offers.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Integer, nullable=False, default=1)
    added_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_cart_item_quantity_positive"),
    )

    cart = relationship("Cart", back_populates="items")
    product = relationship("Product")
    variant = relationship("ProductVariant")
    offer = relationship("NegotiationOffer")
