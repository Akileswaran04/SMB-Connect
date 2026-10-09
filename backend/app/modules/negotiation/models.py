"""Negotiation models — negotiation_rules, negotiation_offers (migrations 006/007)."""
from datetime import datetime

from sqlalchemy import Column, Integer, Float, Boolean, String, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM, JSONB
from sqlalchemy.orm import relationship

from app.infrastructure.postgres.base import Base


def _pg_enum(name, values):
    return PG_ENUM(*values, name=name, create_type=False)


offered_by_enum = _pg_enum("negotiationofferedby", ["buyer", "seller"])
offer_status_enum = _pg_enum("negotiationofferstatus", ["pending", "accepted", "rejected", "countered", "expired"])


class NegotiationRule(Base):
    """A seller's negotiation configuration for one product."""
    __tablename__ = "negotiation_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    enabled = Column(Boolean, nullable=False, default=False)
    min_price = Column(Float, nullable=False)
    auto_accept_threshold = Column(Float, nullable=True)
    counter_offer_range_pct = Column(Float, nullable=False, default=10.0)
    max_rounds = Column(Integer, nullable=False, default=2)
    quantity_discount_rules = Column(JSONB, nullable=True)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("min_price >= 0", name="ck_negotiation_rules_min_price_nonneg"),
    )

    product = relationship("Product")


class NegotiationOffer(Base):
    """One offer/counter-offer in a buyer<->seller negotiation thread."""
    __tablename__ = "negotiation_offers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    buyer_id = Column(Integer, ForeignKey("buyer_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    round = Column(Integer, nullable=False, default=1)
    quantity = Column(Integer, nullable=False, default=1)
    offered_price = Column(Float, nullable=False)
    offered_by = Column(offered_by_enum, nullable=False)
    status = Column(offer_status_enum, nullable=False, default="pending")
    message = Column(String(500), nullable=True)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
    resolved_at = Column(DateTime(), nullable=True)
    fulfilled_order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        CheckConstraint("offered_price >= 0", name="ck_negotiation_offers_price_nonneg"),
    )

    product = relationship("Product")
