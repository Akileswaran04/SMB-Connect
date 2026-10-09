"""Shipment models — shipments, shipment_events (migration 009)."""
from datetime import datetime

from sqlalchemy import Column, Integer, Float, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.infrastructure.postgres.base import Base


class Shipment(Base):
    """One parcel movement for one order, from seller pickup to buyer."""
    __tablename__ = "shipments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shipment_number = Column(String(40), nullable=False, unique=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    seller_id = Column(Integer, ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    buyer_id = Column(Integer, ForeignKey("buyer_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    logistics_partner_id = Column(Integer, ForeignKey("logistics_profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(String(30), nullable=False, default="created")
    package_count = Column(Integer, nullable=False, default=1)
    weight_kg = Column(Float, nullable=True)
    length_cm = Column(Float, nullable=True)
    width_cm = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)
    pickup_address = Column(String(500), nullable=True)
    delivery_address = Column(String(500), nullable=True)
    scheduled_pickup_at = Column(DateTime(), nullable=True)
    accepted_at = Column(DateTime(), nullable=True)
    picked_up_at = Column(DateTime(), nullable=True)
    delivered_at = Column(DateTime(), nullable=True)
    expected_delivery_at = Column(DateTime(), nullable=True)
    current_location = Column(String(255), nullable=True)
    label_generated_at = Column(DateTime(), nullable=True)
    delivery_otp_hash = Column(String(255), nullable=True)
    pod_otp_verified = Column(Boolean, nullable=False, default=False)
    pod_signature_name = Column(String(255), nullable=True)
    pod_photo_url = Column(Text, nullable=True)
    pod_recorded_at = Column(DateTime(), nullable=True)
    failure_reason = Column(String(500), nullable=True)
    delivery_attempts = Column(Integer, nullable=False, default=0)
    delay_notified = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(), nullable=False, default=datetime.utcnow)

    order = relationship("Order")
    partner = relationship("LogisticsProfile")
    events = relationship("ShipmentEvent", order_by="ShipmentEvent.id", cascade="all, delete-orphan")


class ShipmentEvent(Base):
    __tablename__ = "shipment_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(30), nullable=False)
    location = Column(String(255), nullable=True)
    notes = Column(String(500), nullable=True)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_role = Column(String(20), nullable=True)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
