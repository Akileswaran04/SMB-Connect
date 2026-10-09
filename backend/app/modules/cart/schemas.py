"""Pydantic schemas for the cart module."""
from datetime import datetime
from typing import Optional, List, Literal

from pydantic import BaseModel, Field

from app.modules.orders.schemas import PaymentMethod, DeliveryOption


class CartItemCreate(BaseModel):
    """Add a product (or an accepted negotiation offer) to the cart."""
    product_id: Optional[int] = None
    variant_id: Optional[int] = None
    offer_id: Optional[int] = None
    quantity: int = Field(1, ge=1, le=1000)


class CartItemUpdate(BaseModel):
    """Set a cart item's quantity."""
    quantity: int = Field(..., ge=1, le=1000)


class CartItemResponse(BaseModel):
    """A cart line, with enough product info to render without a second fetch."""
    id: int
    product_id: int
    variant_id: Optional[int] = None
    offer_id: Optional[int] = None
    product_name: str
    variant_label: Optional[str] = None
    product_image_url: Optional[str] = None
    seller_id: int
    seller_name: Optional[str] = None
    listed_unit_price: float
    unit_price: float
    price_reason: Optional[str] = None
    available_stock: int
    available: bool = True
    quantity: int
    line_total: float
    line_discount: float = 0.0
    added_at: Optional[datetime] = None


class DeliveryQuote(BaseModel):
    option: str
    express_available: bool
    days: int
    charge: float
    expected_date: datetime


class SellerGroup(BaseModel):
    seller_id: int
    seller_name: Optional[str] = None
    items_total: float
    delivery: DeliveryQuote


class CartResponse(BaseModel):
    """The current buyer's cart with every charge spelled out (PRD §20)."""
    id: int
    items: List[CartItemResponse] = Field(default_factory=list)
    groups: List[SellerGroup] = Field(default_factory=list)
    delivery_option: str = "standard"
    subtotal: float
    discount_total: float = 0.0
    items_total: float = 0.0
    delivery_total: float = 0.0
    total: float = 0.0
    item_count: int


class CheckoutRequest(BaseModel):
    """Confirm checkout for the current cart."""
    address_id: int
    payment_method: PaymentMethod = "upi"
    delivery_option: DeliveryOption = "standard"
    notes: Optional[str] = Field(None, max_length=500)


QuoteOption = Literal["standard", "express"]
