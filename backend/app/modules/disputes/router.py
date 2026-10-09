"""Disputes — raised by an order's buyer or seller, resolved by an admin (PRD §51)."""
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.exceptions import NotFoundException, ForbiddenException, ValidationException
from app.modules.disputes.models import Dispute
from app.modules.notifications.service import NotificationService
from app.modules.orders.models import Order
from app.modules.orders.service import OrderService

router = APIRouter()

REASONS = ("item_not_received", "damaged", "wrong_item", "not_as_described", "refund_issue", "payment_issue", "other")


class DisputeCreate(BaseModel):
    order_id: int
    reason: Literal[REASONS]
    description: Optional[str] = Field(None, max_length=2000)


class DisputeResolve(BaseModel):
    status: Literal["under_review", "resolved", "rejected"]
    resolution: Optional[str] = Field(None, max_length=2000)
    refund: bool = False


def _dict(d: Dispute, order: Optional[Order] = None) -> dict:
    return {"id": d.id, "order_id": d.order_id, "order_number": order.order_number if order else None,
            "raised_by_role": d.raised_by_role, "reason": d.reason, "description": d.description,
            "status": d.status, "resolution": d.resolution, "created_at": d.created_at, "resolved_at": d.resolved_at}


@router.post("", status_code=status.HTTP_201_CREATED)
async def raise_dispute(data: DisputeCreate, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.role not in ("buyer", "seller"):
        raise ForbiddenException("Only the order's buyer or seller can raise a dispute")
    orders = OrderService(db)
    order = await orders._load(data.order_id)
    await orders.assert_access(user, order)
    open_one = (await db.execute(
        select(Dispute.id).where(Dispute.order_id == order.id, Dispute.status.in_(("open", "under_review")))
    )).scalar_one_or_none()
    if open_one:
        raise ValidationException("There is already an open dispute for this order")
    dispute = Dispute(order_id=order.id, raised_by_user_id=user.id, raised_by_role=user.role,
                      reason=data.reason, description=data.description)
    db.add(dispute)
    await db.flush()
    other = ("seller", ("Dispute raised", f"The buyer raised a dispute on order {order.order_number}.")) \
        if user.role == "buyer" else ("buyer", ("Dispute raised", f"The seller raised a dispute on order {order.order_number}."))
    await NotificationService(db).notify_order(order, "dispute_raised", **{other[0]: other[1]})
    return _dict(dispute, order)


@router.get("")
async def list_disputes(
    status_filter: Optional[str] = Query(None, alias="status"),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Dispute, Order).join(Order, Dispute.order_id == Order.id)
    if user.role != "admin":
        query = query.where(Dispute.raised_by_user_id == user.id)
    if status_filter:
        query = query.where(Dispute.status == status_filter)
    rows = (await db.execute(query.order_by(Dispute.id.desc()).limit(200))).all()
    return [_dict(d, o) for d, o in rows]


@router.patch("/{dispute_id}")
async def resolve_dispute(
    dispute_id: int,
    data: DisputeResolve,
    admin=Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    dispute = await db.get(Dispute, dispute_id)
    if not dispute:
        raise NotFoundException("Dispute", str(dispute_id))
    orders = OrderService(db)
    order = await orders._load(dispute.order_id)
    if data.refund:
        status_now = order.status.value if hasattr(order.status, "value") else order.status
        if status_now in ("delivered", "return_requested", "delivery_failed", "returned"):
            await orders.transition(order, "refunded", admin.id, "admin", notes=f"Dispute #{dispute.id} resolved with refund")
        else:
            await orders._refund(order)
    dispute.status = data.status
    dispute.resolution = data.resolution
    if data.status in ("resolved", "rejected"):
        dispute.resolved_by = admin.id
        dispute.resolved_at = datetime.utcnow()
        msg = ("Dispute " + data.status, f"Your dispute on order {order.order_number} was {data.status}."
               + (f" {data.resolution}" if data.resolution else ""))
        await NotificationService(db).notify_order(order, "dispute_" + data.status, buyer=msg, seller=msg)
    await db.flush()
    return _dict(dispute, order)
