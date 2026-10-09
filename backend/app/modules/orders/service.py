"""Order Service — checkout, the order state machine (PRD §59), and the buyer /
seller / admin order actions.

Every status change goes through `transition()`, which checks the state
machine and who may make the move, applies inventory and payment side
effects, writes a TrackingEvent and notifies the people involved.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundException, ForbiddenException, ValidationException
from app.modules.buyer_profile.models import BuyerProfile, Address
from app.modules.catalogue.pricing import unit_price, delivery_quote, same_city
from app.modules.inventory.models import ProductVariant
from app.modules.inventory.service import InventoryService
from app.modules.logistics.models import LogisticsProfile
from app.modules.notifications.service import NotificationService
from app.modules.orders.models import Order, Review, TrackingEvent
from app.modules.orders.repository import OrderRepository
from app.modules.orders.schemas import OrderCreate, OrderStatusUpdate, OrderReviewCreate
from app.modules.payments.models import Payment, Transaction
from app.modules.platform.service import PlatformSettingsService
from app.modules.seller_profile.models import SellerProfile, Product
from app.modules.shipments.models import Shipment
from app.modules.shipments.otp import delivery_otp


# Order state machine (PRD §59): each status lists the statuses it may move to.
# Cancellation is only allowed before the order is packed. The first three
# entries cover legacy statuses from before the full lifecycle existed.
_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"seller_confirmed", "cancelled"},
    "confirmed": {"processing", "cancelled"},
    "shipped": {"in_transit", "out_for_delivery", "delivered"},
    "created": {"payment_pending", "paid", "cancelled"},
    # Cash on delivery: fulfilment goes ahead while payment is still pending.
    "payment_pending": {"paid", "seller_confirmed", "cancelled"},
    "paid": {"seller_confirmed", "cancelled"},
    "seller_confirmed": {"processing", "cancelled"},
    "processing": {"packed", "cancelled"},
    "packed": {"ready_for_pickup"},
    "ready_for_pickup": {"picked_up"},
    "picked_up": {"in_transit"},
    "in_transit": {"out_for_delivery"},
    "out_for_delivery": {"delivered", "delivery_failed"},
    "delivery_failed": {"out_for_delivery", "returned"},
    "delivered": {"return_requested"},
    "return_requested": {"returned"},
    "returned": {"refunded"},
}

# Dispute resolution: an admin may refund an order after it has shipped.
_ADMIN_EXTRA: dict[str, set[str]] = {
    "delivered": {"refunded"},
    "return_requested": {"refunded"},
    "delivery_failed": {"refunded"},
}

# Which statuses each role may set (PRD §36, §42–45).
_ROLE_TARGETS: dict[str, set[str]] = {
    "seller": {"seller_confirmed", "processing", "packed", "ready_for_pickup", "cancelled", "returned", "refunded"},
    "buyer": {"cancelled", "return_requested"},
    "logistics": {"picked_up", "in_transit", "out_for_delivery", "delivered", "delivery_failed", "returned"},
}

_TERMINAL = {"delivered", "cancelled", "returned", "refunded", "return_requested"}
STATUS_GROUPS = {
    "active": lambda s: s not in _TERMINAL,
    "delivered": lambda s: s in {"delivered", "return_requested", "returned", "refunded"},
    "cancelled": lambda s: s == "cancelled",
}
_CANCELLABLE = {s for s, targets in _TRANSITIONS.items() if "cancelled" in targets}
PAYMENT_METHODS = {"upi", "card", "netbanking", "cod", "mock"}

# (buyer message, seller message) per status; None = no notification.
_STATUS_NOTICES: dict[str, tuple] = {
    "seller_confirmed": (("Seller confirmed your order", "{seller} confirmed order {num} and is preparing it."), None),
    "picked_up": (("Pickup completed", "Order {num} has been picked up by the courier."),
                  ("Pickup completed", "The courier collected order {num}.")),
    "out_for_delivery": (("Out for delivery", "Order {num} is out for delivery today. Keep your delivery OTP ready."), None),
    "delivered": (("Delivered", "Order {num} was delivered. Enjoy!"),
                  ("Order delivered", "Order {num} was delivered to the buyer.")),
    "delivery_failed": (("Delivery attempt failed", "We couldn't deliver order {num}. The courier will try again."),
                        ("Delivery attempt failed", "Delivery of order {num} failed.")),
    "cancelled": (("Order cancelled", "Order {num} was cancelled."), ("Order cancelled", "Order {num} was cancelled.")),
    "return_requested": (("Return initiated", "Your return for order {num} has been requested."),
                         ("Return requested", "The buyer requested a return for order {num}.")),
    "returned": (("Return received", "The seller received your return for order {num}."), None),
    "refunded": (("Refund completed", "Your refund for order {num} has been processed."),
                 ("Order refunded", "Order {num} was refunded.")),
}


def _status(value) -> str:
    return value.value if hasattr(value, "value") else value


def _money(x: float) -> float:
    return round(float(x or 0), 2)


def _naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """tracking_events.created_at is timestamptz; the rest of the order data
    is naive UTC. Normalise before comparing."""
    if dt is not None and dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class OrderService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = OrderRepository(db)
        self.notifications = NotificationService(db)

    # ── Identity helpers ──

    async def _buyer(self, user_id: int) -> BuyerProfile:
        profile = (await self.db.execute(select(BuyerProfile).where(BuyerProfile.user_id == user_id))).scalar_one_or_none()
        if not profile:
            raise ForbiddenException("Only buyers can do this")
        return profile

    async def _get_buyer_id_from_user(self, user_id: int) -> int:
        return (await self._buyer(user_id)).id

    async def _seller(self, user_id: int) -> SellerProfile:
        profile = (await self.db.execute(select(SellerProfile).where(SellerProfile.user_id == user_id))).scalar_one_or_none()
        if not profile:
            raise ForbiddenException("Only sellers can do this")
        return profile

    async def _get_seller_id_from_user(self, user_id: int) -> int:
        return (await self._seller(user_id)).id

    async def _load(self, order_id: int) -> Order:
        order = await self.repo.get_by_id(order_id)
        if not order:
            raise NotFoundException("Order", str(order_id))
        return order

    async def assert_access(self, user, order: Order) -> None:
        role = user.role
        if role == "admin":
            return
        if role == "buyer":
            if order.buyer_id != (await self._buyer(user.id)).id:
                raise ForbiddenException("Not your order")
        elif role == "seller":
            if order.seller_id != (await self._seller(user.id)).id:
                raise ForbiddenException("Not your order")
        elif role == "logistics":
            assigned = (await self.db.execute(
                select(Shipment.id)
                .join(LogisticsProfile, Shipment.logistics_partner_id == LogisticsProfile.id)
                .where(Shipment.order_id == order.id, LogisticsProfile.user_id == user.id)
            )).scalar_one_or_none()
            if assigned is None:
                raise ForbiddenException("This shipment is not assigned to you")
        else:
            raise ForbiddenException("Not allowed")

    # ── Checkout ──

    async def create_order(self, user_id: int, data: OrderCreate,
                           price_overrides: Optional[dict] = None,
                           offer_ids: Optional[dict] = None) -> dict:
        """Place one order with one seller. `price_overrides` / `offer_ids` hold
        negotiated prices keyed by (product_id, variant_id) or product_id."""
        buyer = await self._buyer(user_id)
        settings = await PlatformSettingsService(self.db).get_all()
        price_overrides = price_overrides or {}

        address_text, buyer_city = None, buyer.city
        if data.address_id is not None:
            address = (await self.db.execute(
                select(Address).where(Address.id == data.address_id, Address.buyer_id == buyer.id)
            )).scalar_one_or_none()
            if not address:
                raise NotFoundException("Address", str(data.address_id))
            address_text = ", ".join(p for p in [address.line1, address.line2, address.city, address.state,
                                                 address.postal_code, address.country] if p)
            buyer_city = address.city
        elif data.shipping_address and data.shipping_address.strip():
            address_text = data.shipping_address.strip()
        if not address_text:
            raise ValidationException("A delivery address is required")

        method = data.payment_method or "upi"
        if method not in PAYMENT_METHODS:
            raise ValidationException("Unsupported payment method")

        product_ids = {i.product_id for i in data.items}
        products = {p.id: p for p in (await self.db.execute(
            select(Product).where(Product.id.in_(product_ids))
        )).scalars().all()}
        for pid in product_ids:
            if pid not in products:
                raise NotFoundException("Product", str(pid))
            if _status(products[pid].status) != "published":
                raise ValidationException(f"'{products[pid].name}' is no longer available")
        seller_ids = {p.seller_id for p in products.values()}
        if len(seller_ids) != 1:
            raise ValidationException("All order items must come from one seller")
        seller = await self.db.get(SellerProfile, seller_ids.pop())

        variant_ids = [i.variant_id for i in data.items if i.variant_id]
        variants = {v.id: v for v in (await self.db.execute(
            select(ProductVariant).where(ProductVariant.id.in_(variant_ids))
        )).scalars().all()} if variant_ids else {}
        products_with_variants = set((await self.db.execute(
            select(ProductVariant.product_id)
            .where(ProductVariant.product_id.in_(product_ids), ProductVariant.is_active.is_(True))
        )).scalars().all())

        lines, subtotal, items_total = [], 0.0, 0.0
        for item in data.items:
            product = products[item.product_id]
            variant = None
            if item.variant_id:
                variant = variants.get(item.variant_id)
                if not variant or variant.product_id != product.id or not variant.is_active:
                    raise ValidationException(f"That option of '{product.name}' is not available")
            elif product.id in products_with_variants:
                raise ValidationException(f"Choose a size/colour for '{product.name}'")
            price = unit_price(product, variant, item.quantity)
            line_key = (product.id, item.variant_id)
            unit = price_overrides.get(line_key, price_overrides.get(product.id, price["unit"]))
            subtotal += price["listed"] * item.quantity
            items_total += unit * item.quantity
            lines.append({
                "product_id": product.id,
                "variant_id": variant.id if variant else None,
                "product_name": product.name,
                "variant_label": variant.label if variant else None,
                "listed_unit_price": price["listed"],
                "offer_id": (offer_ids or {}).get(line_key, (offer_ids or {}).get(product.id)),
                "quantity": item.quantity,
                "unit_price": _money(unit),
                "total_price": _money(unit * item.quantity),
            })

        quote = delivery_quote(list(products.values()), items_total, settings, data.delivery_option,
                               same_city(buyer_city, seller.city))
        total = _money(items_total + quote["charge"])

        is_cod = method == "cod"
        if is_cod:
            if not settings["cod_enabled"]:
                raise ValidationException("Cash on delivery is not available right now")
            if total > float(settings["cod_max_amount"]):
                raise ValidationException(f"Cash on delivery is available up to ₹{settings['cod_max_amount']:,.0f}")

        order = await self.repo.create({
            "order_number": f"ORD-{uuid.uuid4().hex[:10].upper()}",
            "buyer_id": buyer.id,
            "seller_id": seller.id,
            "status": "payment_pending" if is_cod else "paid",
            "subtotal": _money(subtotal),
            "discount_amount": _money(subtotal - items_total),
            "delivery_charge": quote["charge"],
            "platform_fee": _money(items_total * float(settings["platform_fee_pct"]) / 100),
            "total_amount": total,
            "currency": "INR",
            "payment_method": method,
            "shipping_address": address_text,
            "address_id": data.address_id,
            "delivery_option": quote["option"],
            "delivery_date": quote["expected_date"],
            "notes": data.notes,
        })
        items = await self.repo.add_items(order.id, lines)
        await InventoryService(self.db, user_id).reserve(order.id, items)

        payment_status = "pending" if is_cod else "completed"
        self.db.add(Payment(order_id=order.id, provider="cod" if is_cod else "mock", status=payment_status,
                            amount=total, currency="INR", reference=f"PAY-{uuid.uuid4().hex[:10].upper()}"))
        self.db.add(Transaction(order_id=order.id, amount=total, currency="INR", status=payment_status,
                                payment_method=method, transaction_id=f"TXN-{uuid.uuid4().hex[:10].upper()}"))
        await self.repo.add_tracking_event(
            order.id, order.status, actor_user_id=user_id, actor_role="buyer",
            notes="Order placed — cash on delivery" if is_cod else "Order placed and paid",
        )

        await self.notifications.notify_order(
            order, "order_confirmed",
            buyer=("Order confirmed", f"Order {order.order_number} with {seller.business_name} is confirmed. "
                   f"Expected by {quote['expected_date']:%a %d %b}."),
            seller=("New order", f"You have a new order {order.order_number} for ₹{total:,.0f}."),
        )
        if not is_cod:
            await self.notifications.notify_order(
                order, "payment_successful",
                buyer=("Payment successful", f"₹{total:,.0f} paid for order {order.order_number}."),
            )
        await self.db.flush()
        return await self.get_order_for(None, order.id, skip_access=True, viewer_role="buyer")

    # ── Queries ──

    async def get_order_for(self, user, order_id: int, skip_access: bool = False, viewer_role: Optional[str] = None) -> dict:
        order = await self._load(order_id)
        if not skip_access:
            await self.assert_access(user, order)
        return (await self._serialize_many([order], viewer_role or user.role))[0]

    async def list_orders(self, user, group: Optional[str] = None, cursor: Optional[str] = None, limit: int = 50) -> dict:
        role = user.role
        query = select(Order).options(selectinload(Order.items))
        if role == "buyer":
            query = query.where(Order.buyer_id == (await self._buyer(user.id)).id)
        elif role == "seller":
            query = query.where(Order.seller_id == (await self._seller(user.id)).id)
        elif role != "admin":
            raise ForbiddenException("Only buyers, sellers and admins can list orders")
        if group in STATUS_GROUPS:
            wanted = [s for s in list(_TRANSITIONS) + ["delivered", "cancelled", "returned", "refunded",
                                                      "return_requested", "delivery_failed"]
                      if STATUS_GROUPS[group](s)]
            query = query.where(Order.status.in_(set(wanted)))
        if cursor and cursor.isdigit():
            query = query.where(Order.id < int(cursor))
        orders = list((await self.db.execute(query.order_by(Order.id.desc()).limit(limit + 1))).scalars().all())
        has_more = len(orders) > limit
        orders = orders[:limit]
        return {
            "items": await self._serialize_many(orders, role),
            "next_cursor": str(orders[-1].id) if has_more and orders else None,
            "limit": limit,
        }

    async def get_tracking(self, user, order_id: int) -> list[dict]:
        order = await self._load(order_id)
        await self.assert_access(user, order)
        events = await self.repo.list_tracking_events(order_id)
        return [
            {"id": e.id, "order_id": e.order_id, "status": e.status, "actor_role": e.actor_role,
             "location": e.location, "notes": e.notes, "created_at": e.created_at}
            for e in events
        ]

    async def _serialize_many(self, orders: list[Order], viewer_role: str) -> list[dict]:
        if not orders:
            return []
        ids = [o.id for o in orders]
        sellers = dict((await self.db.execute(
            select(SellerProfile.id, SellerProfile.business_name).where(SellerProfile.id.in_({o.seller_id for o in orders}))
        )).all())
        buyers = {bid: f"{fn} {ln}".strip() for bid, fn, ln in (await self.db.execute(
            select(BuyerProfile.id, BuyerProfile.first_name, BuyerProfile.last_name)
            .where(BuyerProfile.id.in_({o.buyer_id for o in orders}))
        )).all()}
        product_ids = {i.product_id for o in orders for i in o.items}
        product_rows = {pid: (img, rdays) for pid, img, rdays in (await self.db.execute(
            select(Product.id, Product.image_url, Product.return_days).where(Product.id.in_(product_ids))
        )).all()} if product_ids else {}
        payments = {oid: (st, settle) for oid, st, settle in (await self.db.execute(
            select(Payment.order_id, Payment.status, Payment.settlement_status).where(Payment.order_id.in_(ids))
        )).all()}
        shipments = {s.order_id: (s, partner) for s, partner in (await self.db.execute(
            select(Shipment, LogisticsProfile.company_name)
            .outerjoin(LogisticsProfile, Shipment.logistics_partner_id == LogisticsProfile.id)
            .where(Shipment.order_id.in_(ids))
        )).all()}
        reviewed = set((await self.db.execute(select(Review.order_id).where(Review.order_id.in_(ids)))).scalars().all())
        delivered_at = dict((await self.db.execute(
            select(TrackingEvent.order_id, func.max(TrackingEvent.created_at))
            .where(TrackingEvent.order_id.in_(ids), TrackingEvent.status == "delivered")
            .group_by(TrackingEvent.order_id)
        )).all())

        now = datetime.utcnow()
        out = []
        for o in orders:
            status = _status(o.status)
            ship, partner = shipments.get(o.id, (None, None))
            return_days = max((product_rows.get(i.product_id, (None, 7))[1] or 0 for i in o.items), default=7)
            delivered = _naive_utc(delivered_at.get(o.id))
            pay_status, settlement = payments.get(o.id, (None, None))
            show_otp = viewer_role == "buyer" and ship is not None and ship.status not in ("delivered", "created")
            out.append({
                "id": o.id,
                "order_number": o.order_number,
                "buyer_id": o.buyer_id,
                "seller_id": o.seller_id,
                "seller_name": sellers.get(o.seller_id),
                "buyer_name": buyers.get(o.buyer_id) if viewer_role != "buyer" else None,
                "status": status,
                "subtotal": o.subtotal if o.subtotal is not None else o.total_amount,
                "discount_amount": o.discount_amount or 0.0,
                "delivery_charge": o.delivery_charge or 0.0,
                "platform_fee": o.platform_fee if viewer_role in ("seller", "admin") else None,
                "total_amount": o.total_amount,
                "currency": o.currency,
                "payment_method": o.payment_method,
                "payment_status": pay_status,
                "settlement_status": settlement if viewer_role in ("seller", "admin") else None,
                "shipping_address": o.shipping_address,
                "delivery_option": o.delivery_option,
                "expected_delivery": o.delivery_date,
                "notes": o.notes,
                "cancel_reason": o.cancel_reason,
                "return_reason": o.return_reason,
                "items": [{
                    "id": i.id, "product_id": i.product_id, "variant_id": i.variant_id,
                    "product_name": i.product_name, "variant_label": i.variant_label,
                    "image_url": product_rows.get(i.product_id, (None, None))[0],
                    "quantity": i.quantity, "unit_price": i.unit_price,
                    "listed_unit_price": i.listed_unit_price, "total_price": i.total_price,
                } for i in o.items],
                "shipment": {
                    "id": ship.id, "shipment_number": ship.shipment_number, "status": ship.status,
                    "partner_name": partner, "current_location": ship.current_location,
                    "expected_delivery_at": ship.expected_delivery_at, "delivered_at": ship.delivered_at,
                } if ship else None,
                "delivery_otp": delivery_otp(ship.id, ship.shipment_number) if show_otp else None,
                "can_cancel": status in _CANCELLABLE,
                "can_return": status == "delivered" and delivered is not None
                              and now <= delivered + timedelta(days=return_days),
                "can_review": status == "delivered" and o.id not in reviewed,
                "created_at": o.created_at,
                "updated_at": o.updated_at,
            })
        return out

    # ── State machine ──

    async def transition(self, order: Order, target: str, actor_user_id: Optional[int], actor_role: str,
                         location: Optional[str] = None, notes: Optional[str] = None) -> Order:
        # Re-read the status under a row lock so two concurrent updates can't
        # both pass the transition check (e.g. a double cancel restocking twice).
        current = _status((await self.db.execute(
            select(Order.status).where(Order.id == order.id).with_for_update()
        )).scalar_one())
        allowed = set(_TRANSITIONS.get(current, set()))
        if actor_role == "admin":
            allowed |= _ADMIN_EXTRA.get(current, set())
        if target not in allowed:
            raise ValidationException(f"Cannot move an order from '{current}' to '{target}'")
        if actor_role in _ROLE_TARGETS and target not in _ROLE_TARGETS[actor_role]:
            raise ForbiddenException(f"A {actor_role} can't mark an order '{target}'")

        inventory = InventoryService(self.db, actor_user_id)
        if target == "cancelled":
            # PRD §60: stock held for the order goes back to available.
            await inventory.release(order.id, order.items)
            await self._settle_payment_on_cancel(order)
            order.cancel_reason = notes or order.cancel_reason
        elif target == "picked_up":
            await inventory.fulfil(order.id, order.items)
        elif target == "delivered":
            # Cash on delivery is collected at the door; the seller's payout
            # is now due.
            for model in (Payment, Transaction):
                for row in (await self.db.execute(select(model).where(model.order_id == order.id))).scalars():
                    if row.status == "pending":
                        row.status = "completed"
            payment = (await self.db.execute(select(Payment).where(Payment.order_id == order.id))).scalar_one_or_none()
            if payment:
                payment.settlement_status = "scheduled"
        elif target == "returned":
            await inventory.restock_return(order.id, order.items)
        elif target == "refunded":
            await self._refund(order)
        elif target == "return_requested":
            order.return_reason = notes

        order.status = target
        order.updated_at = datetime.utcnow()
        await self.repo.add_tracking_event(order.id, target, actor_user_id=actor_user_id, actor_role=actor_role,
                                           location=location, notes=notes)

        notice = _STATUS_NOTICES.get(target)
        if notice:
            seller_name = (await self.db.execute(
                select(SellerProfile.business_name).where(SellerProfile.id == order.seller_id)
            )).scalar_one_or_none() or "The seller"
            fmt = {"num": order.order_number, "seller": seller_name}
            buyer_msg = (notice[0][0], notice[0][1].format(**fmt)) if notice[0] else None
            seller_msg = (notice[1][0], notice[1][1].format(**fmt)) if notice[1] else None
            await self.notifications.notify_order(order, f"order_{target}", buyer=buyer_msg, seller=seller_msg,
                                                  data={"status": target})
        await self.db.flush()
        return order

    async def _settle_payment_on_cancel(self, order: Order) -> None:
        payment = (await self.db.execute(select(Payment).where(Payment.order_id == order.id))).scalar_one_or_none()
        txn = (await self.db.execute(select(Transaction).where(Transaction.order_id == order.id))).scalar_one_or_none()
        if payment and payment.status == "completed":
            await self._refund(order)
        else:
            if payment:
                payment.status = "cancelled"
            if txn:
                txn.status = "failed"
                txn.failure_reason = "Order cancelled before payment"

    async def _refund(self, order: Order) -> None:
        payment = (await self.db.execute(select(Payment).where(Payment.order_id == order.id))).scalar_one_or_none()
        txn = (await self.db.execute(select(Transaction).where(Transaction.order_id == order.id))).scalar_one_or_none()
        if payment and payment.status == "completed":
            payment.status = "refunded"
            payment.settlement_status = "reversed" if payment.settlement_status == "settled" else "cancelled"
            if txn:
                txn.status = "refunded"
            await self.notifications.notify_order(
                order, "refund_completed",
                buyer=("Refund completed", f"₹{order.total_amount:,.0f} for order {order.order_number} is on its way back to you."),
                dedupe_suffix="refund",
            )

    # ── Role actions ──

    async def update_status(self, user, order_id: int, data: OrderStatusUpdate) -> dict:
        order = await self._load(order_id)
        await self.assert_access(user, order)
        if user.role not in ("seller", "admin"):
            raise ForbiddenException("Use the cancel or return actions instead")
        await self.transition(order, data.status, user.id, user.role, data.location, data.notes)
        return await self.get_order_for(user, order_id)

    async def cancel(self, user, order_id: int, reason: Optional[str]) -> dict:
        order = await self._load(order_id)
        await self.assert_access(user, order)
        if user.role not in ("buyer", "seller", "admin"):
            raise ForbiddenException("Not allowed")
        await self.transition(order, "cancelled", user.id, user.role,
                              notes=reason or f"Cancelled by {user.role}")
        return await self.get_order_for(user, order_id)

    async def request_return(self, user, order_id: int, reason: str) -> dict:
        order = await self._load(order_id)
        await self.assert_access(user, order)
        detail = await self.get_order_for(user, order_id)
        if not detail["can_return"]:
            raise ValidationException("This order can't be returned (only delivered orders, within the return window)")
        await self.transition(order, "return_requested", user.id, "buyer", notes=reason)
        return await self.get_order_for(user, order_id)

    async def add_review(self, user_id: int, order_id: int, data: OrderReviewCreate) -> dict:
        order = await self._load(order_id)
        buyer_id = await self._get_buyer_id_from_user(user_id)
        if order.buyer_id != buyer_id:
            raise ForbiddenException("Not your order")
        if _status(order.status) != "delivered":
            raise ValidationException("You can review an order once it has been delivered")
        if (await self.db.execute(select(Review).where(Review.order_id == order_id))).scalar_one_or_none():
            raise ValidationException("Order already reviewed")

        first_item = order.items[0] if order.items else None
        review = Review(
            product_id=first_item.product_id if first_item else None,
            buyer_id=buyer_id, seller_id=order.seller_id, order_id=order_id,
            rating=data.rating, title=data.title, comment=data.comment, is_verified_purchase=True,
        )
        self.db.add(review)
        await self.db.flush()
        await self.db.refresh(review)
        return {"id": review.id, "order_id": review.order_id, "rating": review.rating, "title": review.title,
                "comment": review.comment, "is_verified_purchase": review.is_verified_purchase}

    async def reorder(self, user, order_id: int, add_to_cart: bool = True) -> dict:
        """PRD §28: prefill the same items, options, address and delivery; the
        buyer reviews everything in the cart before paying."""
        order = await self._load(order_id)
        await self.assert_access(user, order)
        if user.role != "buyer":
            raise ForbiddenException("Only the buyer can reorder")
        items = []
        for i in order.items:
            product = await self.db.get(Product, i.product_id)
            variant = await self.db.get(ProductVariant, i.variant_id) if i.variant_id else None
            target = variant or product
            available = bool(product and _status(product.status) == "published"
                             and (variant is None or variant.is_active) and target.stock > 0)
            items.append({
                "product_id": i.product_id, "variant_id": i.variant_id,
                "product_name": product.name if product else i.product_name,
                "variant_label": i.variant_label,
                "quantity": min(i.quantity, target.stock) if available else i.quantity,
                "available": available,
                "current_unit_price": unit_price(product, variant, i.quantity)["unit"] if product else None,
            })
        added = 0
        if add_to_cart:
            from app.modules.cart.service import CartService  # avoid an import cycle
            cart = CartService(self.db)
            for it in items:
                if it["available"] and it["quantity"] > 0:
                    await cart.set_line(user.id, it["product_id"], it["variant_id"], it["quantity"])
                    added += 1
        return {
            "order_id": order.id,
            "items": items,
            "added_to_cart": added,
            "address_id": order.address_id,
            "delivery_option": order.delivery_option,
            "payment_method": order.payment_method if order.payment_method in PAYMENT_METHODS else "upi",
        }

    async def invoice(self, user, order_id: int) -> dict:
        order = await self._load(order_id)
        await self.assert_access(user, order)
        detail = (await self._serialize_many([order], "admin"))[0]
        seller = await self.db.get(SellerProfile, order.seller_id)
        buyer = await self.db.get(BuyerProfile, order.buyer_id)
        return {
            "invoice_number": f"INV-{order.order_number.removeprefix('ORD-')}",
            "issued_at": order.created_at,
            "order_number": order.order_number,
            "seller": {
                "name": seller.business_name, "license_number": seller.license_number,
                "address": ", ".join(p for p in [seller.address_line_1, seller.city, seller.state, seller.postal_code] if p),
                "phone": seller.phone, "email": seller.email,
            },
            "buyer": {"name": f"{buyer.first_name} {buyer.last_name}".strip(), "address": order.shipping_address},
            "items": detail["items"],
            "subtotal": detail["subtotal"],
            "discount_amount": detail["discount_amount"],
            "delivery_charge": detail["delivery_charge"],
            "total_amount": detail["total_amount"],
            "payment_method": order.payment_method,
            "payment_status": detail["payment_status"],
            "currency": order.currency,
        }
