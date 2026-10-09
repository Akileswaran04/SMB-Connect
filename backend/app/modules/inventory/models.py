"""Inventory models — product_variants, inventory_transactions (migration 009)."""
from datetime import datetime

from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship

from app.infrastructure.postgres.base import Base


class ProductVariant(Base):
    """A size/colour option of a product with its own stock (and optional price)."""
    __tablename__ = "product_variants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    sku = Column(String(64), nullable=True)
    size = Column(String(30), nullable=True)
    color = Column(String(40), nullable=True)
    price = Column(Float, nullable=True)  # None = product price
    stock = Column(Integer, nullable=False, default=0)
    reserved_stock = Column(Integer, nullable=False, default=0)
    incoming_stock = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("stock >= 0", name="ck_variant_stock_nonneg"),
        CheckConstraint("reserved_stock >= 0", name="ck_variant_reserved_nonneg"),
    )

    product = relationship("Product", back_populates="variants")

    @property
    def label(self) -> str:
        parts = [f"Size {self.size}" if self.size else None, self.color]
        return " / ".join(p for p in parts if p) or "Default"


class InventoryTransaction(Base):
    """Append-only log of every stock and reservation change."""
    __tablename__ = "inventory_transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True)
    stock_change = Column(Integer, nullable=False, default=0)
    reserved_change = Column(Integer, nullable=False, default=0)
    reason = Column(String(40), nullable=False)
    note = Column(String(255), nullable=True)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
