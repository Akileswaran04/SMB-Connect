"""Negotiation Router — HTTP endpoints only."""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_optional_user
from app.modules.negotiation.dependencies import get_negotiation_service
from app.modules.negotiation.schemas import (
    NegotiationRuleUpsert, NegotiationRuleResponse, NegotiationSuggestionResponse,
    OfferCreate, OfferRespondRequest, OfferResponse, OfferCheckoutRequest,
)
from app.modules.negotiation.service import NegotiationService
from app.modules.orders.schemas import OrderResponse

router = APIRouter()


@router.put("/products/{product_id}/rule", response_model=NegotiationRuleResponse)
async def upsert_rule(
    product_id: int,
    data: NegotiationRuleUpsert,
    user=Depends(get_current_user),
    service: NegotiationService = Depends(get_negotiation_service),
):
    """Seller configures negotiation for one of their products."""
    return await service.upsert_rule(user.id, product_id, data)


@router.get("/products/{product_id}/rule", response_model=Optional[NegotiationRuleResponse])
async def get_rule(
    product_id: int,
    user=Depends(get_current_user),
    service: NegotiationService = Depends(get_negotiation_service),
):
    """Seller views their own negotiation rule for a product."""
    return await service.get_rule(user.id, product_id)


@router.get("/products/{product_id}/suggestion", response_model=NegotiationSuggestionResponse)
async def get_suggestion(
    product_id: int,
    quantity: int = Query(1, ge=1),
    desired_price: Optional[float] = Query(None, gt=0),
    user=Depends(get_optional_user),
    service: NegotiationService = Depends(get_negotiation_service),
):
    """'Try for a better price': a suggested offer, or — for a price the buyer
    names — whether it's in range and what to try instead."""
    return await service.get_suggestion(product_id, quantity, desired_price, user.id if user else None)


@router.post("/offers", response_model=OfferResponse)
async def create_offer(
    data: OfferCreate,
    user=Depends(get_current_user),
    service: NegotiationService = Depends(get_negotiation_service),
):
    """Buyer starts (or continues) a negotiation with an offer they've approved."""
    return await service.create_offer(user.id, data)


@router.post("/offers/{offer_id}/respond", response_model=OfferResponse)
async def respond_to_offer(
    offer_id: int,
    data: OfferRespondRequest,
    user=Depends(get_current_user),
    service: NegotiationService = Depends(get_negotiation_service),
):
    """Accept, reject, or counter a pending offer (whichever side didn't send it)."""
    return await service.respond_to_offer(user.id, user.role, offer_id, data)


@router.get("/products/{product_id}/thread", response_model=List[OfferResponse])
async def get_thread(
    product_id: int,
    user=Depends(get_current_user),
    service: NegotiationService = Depends(get_negotiation_service),
):
    """Buyer's full offer history for one product."""
    return await service.list_thread(user.id, product_id)


@router.get("/offers", response_model=List[OfferResponse])
async def list_offers(
    status: Optional[str] = Query(None),
    user=Depends(get_current_user),
    service: NegotiationService = Depends(get_negotiation_service),
):
    """List the current user's offers (seller: incoming; buyer: sent)."""
    if user.role == "seller":
        return await service.list_for_seller(user.id, status=status)
    return await service.list_for_buyer(user.id, status=status)


@router.post("/offers/{offer_id}/checkout", response_model=OrderResponse)
async def checkout_offer(
    offer_id: int,
    data: OfferCheckoutRequest,
    user=Depends(get_current_user),
    service: NegotiationService = Depends(get_negotiation_service),
):
    """Check out an accepted offer at its negotiated price."""
    return await service.checkout_offer(user.id, offer_id, data)
