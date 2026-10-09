from typing import List, Literal, Optional


from fastapi import APIRouter, Depends, Query, status

from app.core.dependencies import get_current_user
from app.modules.orders.dependencies import get_order_service
from app.modules.orders.schemas import (
    OrderCreate, OrderResponse, OrderStatusUpdate, OrderReviewCreate, TrackingEventResponse,
    OrderCancelRequest, OrderReturnRequest, ReorderRequest,
)
from app.modules.orders.service import OrderService

router = APIRouter()


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreate,
    user=Depends(get_current_user),
    service: OrderService = Depends(get_order_service),
):
    return await service.create_order(user.id, data)


@router.get("")
async def list_orders(
    group: Optional[Literal["all", "active", "delivered", "cancelled"]] = Query(None),
    cursor: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    user=Depends(get_current_user),
    service: OrderService = Depends(get_order_service),
):
    """My Orders (buyer), incoming orders (seller) or every order (admin)."""
    return await service.list_orders(user, group=group, cursor=cursor, limit=limit)


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    user=Depends(get_current_user),
    service: OrderService = Depends(get_order_service),
):
    return await service.get_order_for(user, order_id)


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    user=Depends(get_current_user),
    service: OrderService = Depends(get_order_service),
):
    """Seller fulfilment steps (confirm → process → pack → ready) and admin overrides."""
    return await service.update_status(user, order_id, data)


@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: int,
    data: OrderCancelRequest,
    user=Depends(get_current_user),
    service: OrderService = Depends(get_order_service),
):
    return await service.cancel(user, order_id, data.reason)


@router.post("/{order_id}/return", response_model=OrderResponse)
async def request_return(
    order_id: int,
    data: OrderReturnRequest,
    user=Depends(get_current_user),
    service: OrderService = Depends(get_order_service),
):
    return await service.request_return(user, order_id, data.reason)


@router.get("/{order_id}/tracking", response_model=List[TrackingEventResponse])
async def get_order_tracking(
    order_id: int,
    user=Depends(get_current_user),
    service: OrderService = Depends(get_order_service),
):
    return await service.get_tracking(user, order_id)


@router.post("/{order_id}/review")
async def add_order_review(
    order_id: int,
    data: OrderReviewCreate,
    user=Depends(get_current_user),
    service: OrderService = Depends(get_order_service),
):
    return await service.add_review(user.id, order_id, data)


@router.post("/{order_id}/reorder")
async def reorder(
    order_id: int,
    data: ReorderRequest,
    user=Depends(get_current_user),
    service: OrderService = Depends(get_order_service),
):
    """Buy again: the same items/options go into the cart for review."""
    return await service.reorder(user, order_id, data.add_to_cart)


@router.get("/{order_id}/invoice")
async def get_invoice(
    order_id: int,
    user=Depends(get_current_user),
    service: OrderService = Depends(get_order_service),
):
    return await service.invoice(user, order_id)
