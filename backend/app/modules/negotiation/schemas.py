"""Pydantic schemas for the negotiation module."""
from datetime import datetime
from typing import Optional, Literal, List

from pydantic import BaseModel, Field

from app.modules.orders.schemas import PaymentMethod, DeliveryOption


class QuantityDiscount(BaseModel):
    """Buying at least `min_qty` lowers the seller's floor by `discount_pct`."""
    min_qty: int = Field(..., ge=2)
    discount_pct: float = Field(..., gt=0, le=50)


class NegotiationRuleUpsert(BaseModel):
    """Seller configures negotiation for one product (PRD §19, §35)."""
    enabled: bool = True
    min_price: float = Field(..., ge=0)
    auto_accept_threshold: Optional[float] = Field(None, ge=0)
    # Offers this close below the floor get an automatic counter at the floor
    # instead of a rejection.
    counter_offer_range_pct: float = Field(10.0, ge=0, le=100)
    max_rounds: int = Field(2, ge=1, le=10)
    quantity_discount_rules: Optional[List[QuantityDiscount]] = None


class NegotiationRuleResponse(BaseModel):
    """Seller's own view of their negotiation rule (confidential fields included)."""
    id: int
    product_id: int
    enabled: bool
    min_price: float
    auto_accept_threshold: Optional[float]
    counter_offer_range_pct: float
    max_rounds: int
    quantity_discount_rules: Optional[List[QuantityDiscount]] = None


class NegotiationSuggestionResponse(BaseModel):
    """Buyer-facing suggestion. When the buyer names a price below the
    seller's range, `suggested_price` is the lowest price the seller accepts
    (PRD §19: 'Would you like to try ₹1150?')."""
    product_id: int
    listed_price: float
    suggested_price: float
    quantity: int
    negotiation_enabled: bool
    within_range: Optional[bool] = None
    message: Optional[str] = None
    rounds_left: Optional[int] = None


class OfferCreate(BaseModel):
    """Buyer submits an offer (must have explicitly approved this price first)."""
    product_id: int
    quantity: int = Field(1, ge=1, le=1000)
    offered_price: float = Field(..., gt=0)
    message: Optional[str] = Field(None, max_length=500)


class OfferRespondRequest(BaseModel):
    """The side that didn't send a pending offer accepts, rejects or counters it."""
    action: Literal["accept", "reject", "counter"]
    counter_price: Optional[float] = Field(None, gt=0)
    message: Optional[str] = Field(None, max_length=500)


class OfferResponse(BaseModel):
    """One offer/counter-offer."""
    id: int
    product_id: int
    product_name: Optional[str] = None
    listed_price: Optional[float] = None
    buyer_id: int
    buyer_name: Optional[str] = None
    seller_id: int
    round: int
    quantity: int
    offered_price: float
    offered_by: str
    status: str
    message: Optional[str]
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    fulfilled_order_id: Optional[int] = None


class OfferCheckoutRequest(BaseModel):
    """Check out an accepted offer at its negotiated price."""
    address_id: int
    variant_id: Optional[int] = None
    payment_method: PaymentMethod = "upi"
    delivery_option: DeliveryOption = "standard"
    notes: Optional[str] = Field(None, max_length=500)
