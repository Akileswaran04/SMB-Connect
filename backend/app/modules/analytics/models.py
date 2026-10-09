from datetime import datetime

from sqlalchemy import Column, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.infrastructure.postgres.base import Base


class TrustScore(Base):
    __tablename__ = "trust_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    overall_score = Column(Float, nullable=False, default=0.0)
    review_score = Column(Float, nullable=False, default=0.0)
    compliance_score = Column(Float, nullable=False, default=0.0)
    communication_score = Column(Float, nullable=False, default=0.0)
    return_rate = Column(Float, nullable=False, default=0.0)
    dispute_count = Column(Integer, nullable=False, default=0)
    successful_orders = Column(Integer, nullable=False, default=0)
    cancellation_rate = Column(Float, nullable=False, default=0.0)
    last_updated = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    seller = relationship("SellerProfile", foreign_keys=[seller_id])


class AnalyticsSummary(Base):
    __tablename__ = "analytics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(DateTime(), nullable=False, default=datetime.utcnow)
    total_views = Column(Integer, nullable=False, default=0)
    total_clicks = Column(Integer, nullable=False, default=0)
    total_sales = Column(Float, nullable=False, default=0.0)
    total_orders = Column(Integer, nullable=False, default=0)
    total_revenue = Column(Float, nullable=False, default=0.0)
    average_order_value = Column(Float, nullable=False, default=0.0)
    conversion_rate = Column(Float, nullable=False, default=0.0)
    visitor_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    response_time_avg = Column(Float, nullable=True)

    seller = relationship("SellerProfile", foreign_keys=[seller_id])