"""Cart Router — HTTP endpoints only."""
from typing import List

from fastapi import APIRouter, Depends, Query, status

from app.core.dependencies import get_current_user_id
from app.modules.cart.dependencies import get_cart_service
from app.modules.cart.schemas import CartResponse, CartItemCreate, CartItemUpdate, CheckoutRequest, QuoteOption
from app.modules.cart.service import CartService
from app.modules.orders.schemas import OrderResponse

router = APIRouter()


@router.get("", response_model=CartResponse)
async def get_cart(
    delivery_option: QuoteOption = Query("standard"),
    user_id: str = Depends(get_current_user_id),
    service: CartService = Depends(get_cart_service),
):
    """The current buyer's cart, priced for the chosen delivery option."""
    return await service.get_cart(int(user_id), delivery_option)


@router.post("/items", response_model=CartResponse)
async def add_cart_item(
    data: CartItemCreate,
    user_id: str = Depends(get_current_user_id),
    service: CartService = Depends(get_cart_service),
):
    """Add a product/variant, or an accepted offer at its negotiated price."""
    return await service.add_item(int(user_id), data)


@router.patch("/items/{item_id}", response_model=CartResponse)
async def update_cart_item(
    item_id: int,
    data: CartItemUpdate,
    user_id: str = Depends(get_current_user_id),
    service: CartService = Depends(get_cart_service),
):
    """Set a cart item's quantity."""
    return await service.update_item(int(user_id), item_id, data)


@router.delete("/items/{item_id}", response_model=CartResponse)
async def remove_cart_item(
    item_id: int,
    user_id: str = Depends(get_current_user_id),
    service: CartService = Depends(get_cart_service),
):
    """Remove an item from the cart."""
    return await service.remove_item(int(user_id), item_id)


@router.delete("", response_model=CartResponse)
async def clear_cart(
    user_id: str = Depends(get_current_user_id),
    service: CartService = Depends(get_cart_service),
):
    """Empty the cart."""
    return await service.clear_cart(int(user_id))


@router.post("/checkout", response_model=List[OrderResponse], status_code=status.HTTP_201_CREATED)
async def checkout(
    data: CheckoutRequest,
    user_id: str = Depends(get_current_user_id),
    service: CartService = Depends(get_cart_service),
):
    """Confirm checkout — splits the cart into one order per seller."""
    return await service.checkout(int(user_id), data)
