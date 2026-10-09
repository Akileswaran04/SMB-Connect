"""Catalogue models — categories, product_reports (migration 009)."""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey

from app.infrastructure.postgres.base import Base


class Category(Base):
    """Admin-managed category list shown as quick categories and filters."""
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    icon = Column(String(50), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)


class ProductReport(Base):
    """A buyer's report of an inappropriate product, for admin moderation."""
    __tablename__ = "product_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    reporter_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reason = Column(String(500), nullable=False)
    status = Column(String(20), nullable=False, default="open")  # open / resolved / dismissed
    resolution_note = Column(String(500), nullable=True)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
    resolved_at = Column(DateTime(), nullable=True)
