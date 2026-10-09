"""Negotiation Service — business logic (PRD §18, §19, §35).

Symmetric offer/counter-offer model: a pending offer's "offered_by" marks who
sent it, so the *other* side is the one allowed to accept/reject/counter it.
`create_offer` starts a thread; every response after that goes through
`respond_to_offer`.

Seller rules, all enforced server-side:
- min_price: the floor, lowered by quantity discounts for bulk buyers;
- auto_accept_threshold: offers at or above it are accepted instantly;
- counter_offer_range_pct: offers just below the floor get an automatic
  counter at the floor instead of a rejection;
- max_rounds: how many offers a buyer may make.

Nothing is committed to an order until the buyer checks out an *accepted*
offer, and every offer is one the buyer explicitly sent.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.negotiation.repository import NegotiationRepository
from app.modules.negotiation.schemas import NegotiationRuleUpsert, OfferCreate, OfferRespondRequest, OfferCheckoutRequest
from app.modules.catalogue.pricing import unit_price
from app.modules.notifications.service import NotificationService
from app.modules.seller_profile.models import SellerProfile, Product
from app.modules.buyer_profile.models import BuyerProfile
from app.modules.orders.service import OrderService
from app.modules.orders.schemas import OrderCreate, OrderItemCreate
from app.core.exceptions import NotFoundException, ForbiddenException, ValidationException


def _inr(x: float) -> str:
    return f"₹{x:,.0f}" if float(x).is_integer() else f"₹{x:,.2f}"


def _discount_tiers(rule) -> list[dict]:
    raw = rule.quantity_discount_rules or []
    if isinstance(raw, dict):  # older rows stored {"tiers": [...]}
        raw = raw.get("tiers", [])
    tiers = []
    for t in raw:
        try:
            tiers.append({"min_qty": int(t["min_qty"]), "discount_pct": float(t["discount_pct"])})
        except (KeyError, TypeError, ValueError):
            continue
    return sorted(tiers, key=lambda t: t["min_qty"])


def floor_for(rule, quantity: int) -> float:
    """The seller's lowest acceptable unit price for this quantity."""
    pct = max((t["discount_pct"] for t in _discount_tiers(rule) if quantity >= t["min_qty"]), default=0.0)
    return round(rule.min_price * (1 - pct / 100), 2)


def _clean(price: float, low: float, high: float) -> float:
    """Round a suggestion to a friendly number without leaving [low, high]."""
    step = 10 if price >= 500 else 1
    rounded = round(price / step) * step
    return round(min(max(rounded, low), high), 2)


def _rule_response(rule) -> dict:
    return {
        "id": rule.id,
        "product_id": rule.product_id,
        "enabled": rule.enabled,
        "min_price": rule.min_price,
        "auto_accept_threshold": rule.auto_accept_threshold,
        "counter_offer_range_pct": rule.counter_offer_range_pct,
        "max_rounds": rule.max_rounds,
        "quantity_discount_rules": _discount_tiers(rule),
    }


def _offer_response(offer, buyer_name: Optional[str] = None) -> dict:
    return {
        "id": offer.id,
        "product_id": offer.product_id,
        "product_name": offer.product.name if offer.product else None,
        "listed_price": offer.product.price if offer.product else None,
        "buyer_id": offer.buyer_id,
        "buyer_name": buyer_name,
        "seller_id": offer.seller_id,
        "round": offer.round,
        "quantity": offer.quantity,
        "offered_price": offer.offered_price,
        "offered_by": offer.offered_by.value if hasattr(offer.offered_by, "value") else offer.offered_by,
        "status": offer.status.value if hasattr(offer.status, "value") else offer.status,
        "message": offer.message,
        "created_at": offer.created_at,
        "resolved_at": offer.resolved_at,
        "fulfilled_order_id": offer.fulfilled_order_id,
    }


class NegotiationService:
    """Business logic for negotiation rules and offers."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = NegotiationRepository(db)
        self.notifications = NotificationService(db)

    async def _get_buyer_id(self, user_id: int) -> int:
        profile = (await self.db.execute(select(BuyerProfile).where(BuyerProfile.user_id == user_id))).scalar_one_or_none()
        if not profile:
            raise ForbiddenException("Only buyers can negotiate")
        return profile.id

    async def _get_seller_id(self, user_id: int) -> int:
        profile = (await self.db.execute(select(SellerProfile).where(SellerProfile.user_id == user_id))).scalar_one_or_none()
        if not profile:
            raise ForbiddenException("Only sellers can manage negotiation rules")
        return profile.id

    async def _get_product(self, product_id: int) -> Product:
        product = await self.db.get(Product, product_id)
        if not product:
            raise NotFoundException("Product", str(product_id))
        return product

    async def _notify_side(self, offer, side: str, title: str, body: str) -> None:
        model = BuyerProfile if side == "buyer" else SellerProfile
        profile_id = offer.buyer_id if side == "buyer" else offer.seller_id
        user_id = (await self.db.execute(select(model.user_id).where(model.id == profile_id))).scalar_one_or_none()
        await self.notifications.notify(user_id, "negotiation_response" if side == "buyer" else "negotiation_request",
                                        title, body, {"offer_id": offer.id, "product_id": offer.product_id})

    # ── Seller: rule configuration ──

    async def get_rule(self, user_id: int, product_id: int) -> Optional[dict]:
        seller_id = await self._get_seller_id(user_id)
        product = await self._get_product(product_id)
        if product.seller_id != seller_id:
            raise ForbiddenException("Not your product")
        rule = await self.repo.get_rule(product_id)
        return _rule_response(rule) if rule else None

    async def upsert_rule(self, user_id: int, product_id: int, data: NegotiationRuleUpsert) -> dict:
        seller_id = await self._get_seller_id(user_id)
        product = await self._get_product(product_id)
        if product.seller_id != seller_id:
            raise ForbiddenException("Not your product")
        if data.min_price > product.price:
            raise ValidationException("Minimum price cannot exceed the listed price")
        if data.auto_accept_threshold is not None and data.auto_accept_threshold < data.min_price:
            raise ValidationException("Auto-accept threshold cannot be below the minimum price")
        if data.auto_accept_threshold is not None and data.auto_accept_threshold > product.price:
            raise ValidationException("Auto-accept threshold cannot exceed the listed price")
        payload = data.model_dump()
        payload["quantity_discount_rules"] = [t.model_dump() for t in data.quantity_discount_rules or []]
        rule = await self.repo.upsert_rule(product_id, payload)
        return _rule_response(rule)

    # ── Buyer: suggestion + starting an offer ──

    async def get_suggestion(self, product_id: int, quantity: int = 1, desired_price: Optional[float] = None,
                             user_id: Optional[int] = None) -> dict:
        product = await self._get_product(product_id)
        listed = unit_price(product, None, quantity)["unit"]
        rule = await self.repo.get_rule(product_id)
        base = {"product_id": product_id, "listed_price": listed, "quantity": quantity}
        if not rule or not rule.enabled:
            return {**base, "suggested_price": listed, "negotiation_enabled": False,
                    "message": "This seller has fixed prices for this item."}

        floor = floor_for(rule, quantity)
        rounds_left = None
        if user_id is not None:
            buyer = (await self.db.execute(select(BuyerProfile.id).where(BuyerProfile.user_id == user_id))).scalar_one_or_none()
            if buyer:
                thread = await self.repo.list_thread(product_id, buyer)
                rounds_left = max(0, rule.max_rounds - len([o for o in thread if o.offered_by == "buyer"]))

        suggested = _clean((listed + floor) / 2, floor, listed)
        result = {**base, "suggested_price": suggested, "negotiation_enabled": True, "rounds_left": rounds_left}
        if desired_price is not None:
            if desired_price >= listed:
                result.update(within_range=True, suggested_price=listed,
                              message=f"{_inr(desired_price)} is at or above the listed price — you can buy it directly.")
            elif desired_price >= floor:
                result.update(within_range=True, suggested_price=round(desired_price, 2),
                              message=f"{_inr(desired_price)} is within the seller's range. Send this offer?")
            else:
                result.update(within_range=False, suggested_price=floor,
                              message=f"{_inr(desired_price)} is outside the seller's current negotiation range. "
                                      f"Would you like to try {_inr(floor)}?")
        return result

    async def create_offer(self, user_id: int, data: OfferCreate) -> dict:
        buyer_id = await self._get_buyer_id(user_id)
        product = await self._get_product(data.product_id)
        rule = await self.repo.get_rule(data.product_id)
        if not rule or not rule.enabled:
            raise ValidationException("Negotiation is not available for this product")
        listed = unit_price(product, None, data.quantity)["unit"]
        if data.offered_price > listed:
            raise ValidationException("Your offer is above the listed price — you can buy it directly")

        thread = await self.repo.list_thread(data.product_id, buyer_id)
        if any((o.status.value if hasattr(o.status, "value") else o.status) == "pending" for o in thread):
            raise ValidationException("You already have an open offer on this item — respond to it first")
        current_round = len([o for o in thread if o.offered_by == "buyer"]) + 1
        if current_round > rule.max_rounds:
            raise ValidationException("Negotiation round limit reached for this item")

        floor = floor_for(rule, data.quantity)
        auto_counter_from = floor * (1 - (rule.counter_offer_range_pct or 0) / 100)
        status, note = "pending", None
        if data.offered_price < floor:
            status = "countered" if data.offered_price >= auto_counter_from else "rejected"
            note = None if status == "countered" else (
                f"{_inr(data.offered_price)} is outside the seller's current negotiation range. "
                f"You could try {_inr(floor)}.")
        elif rule.auto_accept_threshold is not None and data.offered_price >= floor_for_threshold(rule, data.quantity):
            status = "accepted"

        offer = await self.repo.create_offer({
            "product_id": data.product_id, "buyer_id": buyer_id, "seller_id": product.seller_id,
            "round": current_round, "quantity": data.quantity, "offered_price": data.offered_price,
            "offered_by": "buyer", "status": status, "message": data.message,
            "resolved_at": datetime.utcnow() if status != "pending" else None,
        })

        if status == "countered":
            counter = await self.repo.create_offer({
                "product_id": data.product_id, "buyer_id": buyer_id, "seller_id": product.seller_id,
                "round": current_round, "quantity": data.quantity, "offered_price": floor,
                "offered_by": "seller", "status": "pending",
                "message": "Automatic counter-offer based on the seller's negotiation settings.",
            })
            await self._notify_side(counter, "seller", "Offer auto-countered",
                                    f"A buyer offered {_inr(data.offered_price)} for {product.name}; "
                                    f"your settings countered at {_inr(floor)}.")
            response = _offer_response(offer)
            response["message"] = f"The seller countered at {_inr(floor)}."
            return response
        if status == "pending":
            await self._notify_side(offer, "seller", "New price offer",
                                    f"A buyer offered {_inr(data.offered_price)} × {data.quantity} for {product.name}.")
        elif status == "accepted":
            await self._notify_side(offer, "seller", "Offer auto-accepted",
                                    f"An offer of {_inr(data.offered_price)} for {product.name} met your auto-accept price.")
        response = _offer_response(offer)
        if note:
            response["message"] = note
        return response

    # ── Either side: respond to a pending offer ──

    async def respond_to_offer(self, user_id: int, user_role: str, offer_id: int, data: OfferRespondRequest) -> dict:
        offer = await self.repo.get_offer(offer_id)
        if not offer:
            raise NotFoundException("NegotiationOffer", str(offer_id))
        if (offer.status.value if hasattr(offer.status, "value") else offer.status) != "pending":
            raise ValidationException("This offer has already been resolved")

        # The side that did NOT send this offer is the one who may respond.
        if offer.offered_by == "buyer":
            if user_role != "seller":
                raise ForbiddenException("Waiting on the seller to respond")
            if offer.seller_id != await self._get_seller_id(user_id):
                raise ForbiddenException("Not your offer to respond to")
            responder_role, other_role = "seller", "buyer"
        else:
            if user_role != "buyer":
                raise ForbiddenException("Waiting on the buyer to respond")
            if offer.buyer_id != await self._get_buyer_id(user_id):
                raise ForbiddenException("Not your offer to respond to")
            responder_role, other_role = "buyer", "seller"

        product_name = offer.product.name if offer.product else "the item"
        if data.action in ("accept", "reject"):
            status = "accepted" if data.action == "accept" else "rejected"
            updated = await self.repo.update_offer(offer_id, {"status": status, "resolved_at": datetime.utcnow()})
            await self._notify_side(updated, other_role, f"Offer {status}",
                                    f"Your offer of {_inr(offer.offered_price)} for {product_name} was {status}.")
            return _offer_response(updated)

        rule = await self.repo.get_rule(offer.product_id)
        if not rule or not rule.enabled:
            raise ValidationException("Negotiation is no longer available for this product")
        if offer.round >= rule.max_rounds and responder_role == "buyer":
            raise ValidationException("Negotiation round limit reached for this item")
        if data.counter_price is None:
            raise ValidationException("counter_price is required to counter")
        listed = unit_price(offer.product, None, offer.quantity)["unit"]
        if data.counter_price > listed:
            raise ValidationException("A counter-offer can't be above the listed price")
        if responder_role == "seller" and data.counter_price < floor_for(rule, offer.quantity):
            raise ValidationException("Counter price cannot be below your own minimum price")

        await self.repo.update_offer(offer_id, {"status": "countered", "resolved_at": datetime.utcnow()})
        new_offer = await self.repo.create_offer({
            "product_id": offer.product_id, "buyer_id": offer.buyer_id, "seller_id": offer.seller_id,
            "round": offer.round + (1 if responder_role == "buyer" else 0), "quantity": offer.quantity,
            "offered_price": data.counter_price, "offered_by": responder_role, "status": "pending",
            "message": data.message,
        })
        await self._notify_side(new_offer, other_role, "Counter-offer received",
                                f"You received a counter-offer of {_inr(data.counter_price)} for {product_name}.")
        return _offer_response(new_offer)

    # ── Listing ──

    async def list_thread(self, user_id: int, product_id: int) -> list[dict]:
        buyer_id = await self._get_buyer_id(user_id)
        thread = await self.repo.list_thread(product_id, buyer_id)
        return [_offer_response(o) for o in thread]

    async def list_for_seller(self, user_id: int, status: Optional[str] = None) -> list[dict]:
        seller_id = await self._get_seller_id(user_id)
        offers = await self.repo.list_for_seller(seller_id, status=status)
        names = {bid: f"{fn} {ln}".strip() for bid, fn, ln in (await self.db.execute(
            select(BuyerProfile.id, BuyerProfile.first_name, BuyerProfile.last_name)
            .where(BuyerProfile.id.in_({o.buyer_id for o in offers}))
        )).all()} if offers else {}
        return [_offer_response(o, names.get(o.buyer_id)) for o in offers]

    async def list_for_buyer(self, user_id: int, status: Optional[str] = None) -> list[dict]:
        buyer_id = await self._get_buyer_id(user_id)
        offers = await self.repo.list_for_buyer(buyer_id, status=status)
        return [_offer_response(o) for o in offers]

    async def latest_for_buyer(self, user_id: int, product_id: int) -> Optional[dict]:
        thread = await self.list_thread(user_id, product_id)
        return thread[-1] if thread else None

    # ── Checkout at the negotiated price ──

    async def checkout_offer(self, user_id: int, offer_id: int, data: OfferCheckoutRequest) -> dict:
        buyer_id = await self._get_buyer_id(user_id)
        offer = await self.repo.get_offer(offer_id)
        if not offer:
            raise NotFoundException("NegotiationOffer", str(offer_id))
        if offer.buyer_id != buyer_id:
            raise ForbiddenException("Not your offer")
        if (offer.status.value if hasattr(offer.status, "value") else offer.status) != "accepted":
            raise ValidationException("Only an accepted offer can be checked out")
        if offer.fulfilled_order_id is not None:
            raise ValidationException("This offer has already been used for an order")

        order = await OrderService(self.db).create_order(
            user_id,
            OrderCreate(
                items=[OrderItemCreate(product_id=offer.product_id, variant_id=data.variant_id, quantity=offer.quantity)],
                address_id=data.address_id,
                delivery_option=data.delivery_option,
                payment_method=data.payment_method,
                notes=data.notes,
            ),
            price_overrides={offer.product_id: offer.offered_price},
            offer_ids={offer.product_id: offer.id},
        )
        await self.repo.update_offer(offer_id, {"fulfilled_order_id": order["id"]})
        return order


def floor_for_threshold(rule, quantity: int) -> float:
    """Auto-accept threshold, lowered by the same quantity discount as the floor."""
    pct = max((t["discount_pct"] for t in _discount_tiers(rule) if quantity >= t["min_qty"]), default=0.0)
    return round(rule.auto_accept_threshold * (1 - pct / 100), 2)
