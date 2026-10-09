"""Shipment endpoints — seller creation, logistics actions, tracking."""
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.modules.shipments.service import ShipmentService

router = APIRouter()


class ShipmentCreate(BaseModel):
    order_id: int
    package_count: int = Field(1, ge=1, le=100)
    weight_kg: Optional[float] = Field(None, gt=0, le=1000)
    length_cm: Optional[float] = Field(None, gt=0, le=500)
    width_cm: Optional[float] = Field(None, gt=0, le=500)
    height_cm: Optional[float] = Field(None, gt=0, le=500)
    pickup_address: Optional[str] = Field(None, max_length=500)
    scheduled_pickup_at: Optional[datetime] = None
    logistics_partner_id: Optional[int] = None


class AssignRequest(BaseModel):
    logistics_partner_id: int


class StepRequest(BaseModel):
    status: Literal["picked_up", "at_hub", "in_transit", "out_for_delivery", "delivery_failed", "returned_to_seller"]
    location: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=500)


class LocationUpdate(BaseModel):
    location: str = Field(..., min_length=2, max_length=255)


class DeliverRequest(BaseModel):
    otp: Optional[str] = Field(None, max_length=6)
    signature_name: str = Field(..., min_length=2, max_length=255)
    photo_url: Optional[str] = Field(None, max_length=200_000)


def _service(db: AsyncSession = Depends(get_db)) -> ShipmentService:
    return ShipmentService(db)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_shipment(data: ShipmentCreate, user=Depends(get_current_user), service=Depends(_service)):
    """Seller: create the shipment for a packed order and assign a partner."""
    return await service.create(user, data)


@router.get("")
async def list_shipments(
    view: Optional[Literal["pickups", "deliveries", "completed"]] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    user=Depends(get_current_user),
    service=Depends(_service),
):
    return await service.list(user, view, status_filter)


@router.get("/by-order/{order_id}")
async def shipment_for_order(order_id: int, user=Depends(get_current_user), service=Depends(_service)):
    """Live tracking for an order (null until the seller ships it)."""
    return await service.by_order(user, order_id)


@router.get("/{shipment_id}")
async def get_shipment(shipment_id: int, user=Depends(get_current_user), service=Depends(_service)):
    return await service.get(user, shipment_id)


@router.get("/{shipment_id}/label")
async def shipping_label(shipment_id: int, user=Depends(get_current_user), service=Depends(_service)):
    return await service.label(user, shipment_id)


@router.patch("/{shipment_id}/assign")
async def assign_partner(shipment_id: int, data: AssignRequest, user=Depends(get_current_user), service=Depends(_service)):
    return await service.assign(user, shipment_id, data.logistics_partner_id)


@router.post("/{shipment_id}/accept")
async def accept_pickup(shipment_id: int, user=Depends(get_current_user), service=Depends(_service)):
    return await service.accept(user, shipment_id)


@router.post("/{shipment_id}/status")
async def advance(shipment_id: int, data: StepRequest, user=Depends(get_current_user), service=Depends(_service)):
    return await service.advance(user, shipment_id, data.status, data.location, data.notes)


@router.post("/{shipment_id}/location")
async def update_location(shipment_id: int, data: LocationUpdate, user=Depends(get_current_user), service=Depends(_service)):
    return await service.update_location(user, shipment_id, data.location)


@router.post("/{shipment_id}/deliver")
async def deliver(shipment_id: int, data: DeliverRequest, user=Depends(get_current_user), service=Depends(_service)):
    """Proof of delivery: buyer OTP + recipient name (+ optional photo)."""
    return await service.deliver(user, shipment_id, data)
