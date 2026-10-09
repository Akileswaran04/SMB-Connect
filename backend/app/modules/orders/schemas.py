from datetime import datetime
from typing import Optional, List, Literal


from pydantic import BaseModel, Field

PaymentMethod = Literal["upi", "card", "netbanking", "cod", "mock"]
DeliveryOption = Literal["standard", "express"]


class OrderItemCreate(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: int = Field(..., ge=1, le=1000)


class OrderCreate(BaseModel):
    items: List[OrderItemCreate] = Field(..., min_length=1)
    address_id: Optional[int] = None
    shipping_address: Optional[str] = Field(None, max_length=500)
    delivery_option: DeliveryOption = "standard"
    notes: Optional[str] = Field(None, max_length=1000)
    payment_method: PaymentMethod = "upi"


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    variant_id: Optional[int] = None
    product_name: Optional[str] = None
    variant_label: Optional[str] = None
    image_url: Optional[str] = None
    quantity: int
    unit_price: float
    listed_unit_price: Optional[float] = None
    total_price: float


class ShipmentSummary(BaseModel):
    id: int
    shipment_number: str
    status: str
    partner_name: Optional[str] = None
    current_location: Optional[str] = None
    expected_delivery_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None


class OrderResponse(BaseModel):
    id: int
    order_number: str
    buyer_id: int
    seller_id: int
    seller_name: Optional[str] = None
    buyer_name: Optional[str] = None
    status: str
    subtotal: Optional[float] = None
    discount_amount: float = 0.0
    delivery_charge: float = 0.0
    platform_fee: Optional[float] = None
    total_amount: float
    currency: str
    payment_method: Optional[str]
    payment_status: Optional[str] = None
    settlement_status: Optional[str] = None
    shipping_address: Optional[str]
    delivery_option: Optional[str] = None
    expected_delivery: Optional[datetime] = None
    notes: Optional[str]
    cancel_reason: Optional[str] = None
    return_reason: Optional[str] = None
    items: List[OrderItemResponse] = Field(default_factory=list)
    shipment: Optional[ShipmentSummary] = None
    delivery_otp: Optional[str] = None
    can_cancel: bool = False
    can_return: bool = False
    can_review: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


OrderStatus = Literal[
    "pending", "confirmed", "shipped", "delivered", "cancelled", "returned",
    "created", "payment_pending", "paid", "seller_confirmed", "processing",
    "packed", "ready_for_pickup", "picked_up", "in_transit",
    "out_for_delivery", "return_requested", "refunded", "delivery_failed",
]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    location: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=500)


class OrderCancelRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)


class OrderReturnRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


class ReorderRequest(BaseModel):
    add_to_cart: bool = True


class TrackingEventResponse(BaseModel):
    id: int
    order_id: int
    status: str
    actor_role: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class OrderReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=255)
    comment: Optional[str] = Field(None, max_length=2000)
