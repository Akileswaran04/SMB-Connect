"""Seller hub — dashboard, payments/settlements and insights (PRD §31, §39),
all computed from real orders, payments, inventory, offers and messages."""
from collections import Counter
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_roles
from app.core.exceptions import ForbiddenException
from app.infrastructure.mongodb.chat import get_conversations_collection, get_messages_collection
from app.modules.buyer_profile.models import BuyerProfile
from app.modules.negotiation.models import NegotiationOffer
from app.modules.orders.models import Order, OrderItem
from app.modules.payments.models import Payment
from app.modules.seller_profile.models import SellerProfile, Product
from app.modules.shipments.models import Shipment
from app.modules.unified_inbox.service import InboxService

router = APIRouter()
seller_only = require_roles("seller")

_NOT_REVENUE = ("cancelled", "refunded")
_PENDING = ("payment_pending", "paid", "seller_confirmed", "processing", "packed")


async def _seller(db: AsyncSession, user) -> SellerProfile:
    seller = (await db.execute(select(SellerProfile).where(SellerProfile.user_id == user.id))).scalar_one_or_none()
    if not seller:
        raise ForbiddenException("Only sellers have a dashboard")
    return seller


def _v(value):
    return value.value if hasattr(value, "value") else value


@router.get("/dashboard")
async def dashboard(user=Depends(seller_only), db: AsyncSession = Depends(get_db)):
    seller = await _seller(db, user)
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    todays_orders = (await db.execute(select(func.count(Order.id)).where(
        Order.seller_id == seller.id, Order.created_at >= today))).scalar() or 0
    pending = (await db.execute(select(Order.status, func.count(Order.id)).where(
        Order.seller_id == seller.id, Order.status.in_(_PENDING)).group_by(Order.status))).all()
    revenue_today, revenue_30 = [(await db.execute(select(func.coalesce(func.sum(Order.total_amount), 0)).where(
        Order.seller_id == seller.id, Order.created_at >= since, Order.status.notin_(_NOT_REVENUE)))).scalar() or 0.0
        for since in (today, now - timedelta(days=30))]

    products = (await db.execute(select(Product).where(
        Product.seller_id == seller.id, Product.status == "published"))).scalars().all()
    low_stock = [{"id": p.id, "name": p.name, "stock": p.stock, "threshold": p.low_stock_threshold}
                 for p in products if p.stock <= (p.low_stock_threshold or 5)]

    shipments = dict((await db.execute(select(Shipment.status, func.count(Shipment.id)).where(
        Shipment.seller_id == seller.id).group_by(Shipment.status))).all())
    offers = (await db.execute(select(func.count(NegotiationOffer.id)).where(
        NegotiationOffer.seller_id == seller.id, NegotiationOffer.status == "pending",
        NegotiationOffer.offered_by == "buyer"))).scalar() or 0
    try:
        unread = await InboxService(db).get_unread_total(user.id, "seller")
    except Exception:
        unread = 0

    ready_to_ship = (await db.execute(select(func.count(Order.id)).where(
        Order.seller_id == seller.id, Order.status == "packed"))).scalar() or 0
    alerts = []
    if seller.verification_status != "verified":
        alerts.append({"level": "warning", "message": "Your store isn't verified yet — complete your profile and submit it for review."})
    if not (seller.bank_account_last4 or seller.upi_id):
        alerts.append({"level": "warning", "message": "Add bank or UPI details so we can settle your payments."})
    if ready_to_ship:
        alerts.append({"level": "info", "message": f"{ready_to_ship} packed order(s) need a shipment."})
    if shipments.get("created"):
        alerts.append({"level": "error", "message": f"{shipments['created']} shipment(s) have no logistics partner yet."})
    if shipments.get("delivery_failed"):
        alerts.append({"level": "warning", "message": f"{shipments['delivery_failed']} delivery attempt(s) failed."})

    return {
        "todays_orders": todays_orders,
        "pending_orders": sum(n for _, n in pending),
        "pending_by_status": {_v(s): n for s, n in pending},
        "revenue_today": round(float(revenue_today), 2),
        "revenue_30_days": round(float(revenue_30), 2),
        "low_stock": low_stock,
        "shipments": {
            "awaiting_pickup": shipments.get("pickup_assigned", 0) + shipments.get("created", 0),
            "in_transit": sum(shipments.get(s, 0) for s in ("picked_up", "at_hub", "in_transit", "out_for_delivery")),
            "delivered": shipments.get("delivered", 0),
            "failed": shipments.get("delivery_failed", 0),
        },
        "negotiation_requests": offers,
        "customer_messages": unread,
        "alerts": alerts,
    }


@router.get("/payments")
async def payments(user=Depends(seller_only), db: AsyncSession = Depends(get_db)):
    """Per-order money breakdown: amount, discount, delivery, platform fee, net."""
    seller = await _seller(db, user)
    rows = (await db.execute(
        select(Order, Payment).outerjoin(Payment, Payment.order_id == Order.id)
        .where(Order.seller_id == seller.id).order_by(Order.id.desc()).limit(300)
    )).all()
    items, totals = [], Counter()
    for order, payment in rows:
        status = _v(order.status)
        void = status in _NOT_REVENUE
        net = 0.0 if void else round(order.total_amount - (order.platform_fee or 0), 2)
        item = {
            "order_id": order.id, "order_number": order.order_number, "order_status": status,
            "created_at": order.created_at,
            "order_amount": order.subtotal if order.subtotal is not None else order.total_amount,
            "discount": order.discount_amount or 0.0, "delivery_charge": order.delivery_charge or 0.0,
            "platform_fee": 0.0 if void else (order.platform_fee or 0.0),
            "total_paid": order.total_amount, "net_amount": net,
            "payment_method": order.payment_method,
            "payment_status": payment.status if payment else None,
            "settlement_status": payment.settlement_status if payment else None,
            "settled_at": payment.settled_at if payment else None,
        }
        items.append(item)
        if not void:
            totals["gross"] += order.total_amount
            totals["fees"] += order.platform_fee or 0
            totals["net"] += net
            if payment and payment.settlement_status == "settled":
                totals["settled"] += net
            elif payment and payment.settlement_status == "scheduled":
                totals["scheduled"] += net
            else:
                totals["pending"] += net
    return {"items": items, "totals": {k: round(v, 2) for k, v in
                                       {"gross": totals["gross"], "platform_fees": totals["fees"], "net": totals["net"],
                                        "settled": totals["settled"], "scheduled": totals["scheduled"],
                                        "not_yet_due": totals["pending"]}.items()}}


@router.get("/insights")
async def insights(days: int = Query(30, ge=7, le=365), user=Depends(seller_only), db: AsyncSession = Depends(get_db)):
    """Real sales and communication analytics for the seller's Analytics page."""
    seller = await _seller(db, user)
    since = datetime.utcnow() - timedelta(days=days)
    daily = (await db.execute(
        select(func.date(Order.created_at), func.count(Order.id), func.coalesce(func.sum(Order.total_amount), 0))
        .where(Order.seller_id == seller.id, Order.created_at >= since, Order.status.notin_(_NOT_REVENUE))
        .group_by(func.date(Order.created_at)).order_by(func.date(Order.created_at))
    )).all()
    top_products = (await db.execute(
        select(OrderItem.product_name, func.sum(OrderItem.quantity), func.sum(OrderItem.total_price))
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.seller_id == seller.id, Order.created_at >= since, Order.status.notin_(_NOT_REVENUE))
        .group_by(OrderItem.product_name).order_by(func.sum(OrderItem.total_price).desc()).limit(5)
    )).all()
    top_buyers = (await db.execute(
        select(BuyerProfile.first_name, BuyerProfile.last_name, func.count(Order.id), func.sum(Order.total_amount),
               func.max(Order.created_at))
        .join(Order, Order.buyer_id == BuyerProfile.id)
        .where(Order.seller_id == seller.id, Order.status.notin_(_NOT_REVENUE))
        .group_by(BuyerProfile.id).order_by(func.sum(Order.total_amount).desc()).limit(5)
    )).all()
    offers = dict((await db.execute(select(NegotiationOffer.status, func.count(NegotiationOffer.id)).where(
        NegotiationOffer.seller_id == seller.id, NegotiationOffer.offered_by == "buyer").group_by(NegotiationOffer.status))).all())

    sentiment, sources, messages_total = Counter(), Counter(), 0
    try:
        convo_ids = [c["_id"] async for c in (await get_conversations_collection()).find({"sellerId": seller.id}, {"_id": 1})]
        if convo_ids:
            cursor = (await get_messages_collection()).find(
                {"conversationId": {"$in": convo_ids}, "createdAt": {"$gte": since}},
                {"sentiment.label": 1, "source": 1, "senderType": 1},
            )
            async for m in cursor:
                messages_total += 1
                sources[m.get("source") or "in_app"] += 1
                if m.get("senderType") == "buyer":
                    sentiment[((m.get("sentiment") or {}).get("label")) or "neutral"] += 1
    except Exception:
        pass

    revenue = sum(float(r) for _, _, r in daily)
    orders = sum(n for _, n, _ in daily)
    return {
        "days": days,
        "revenue": round(revenue, 2),
        "orders": orders,
        "average_order_value": round(revenue / orders, 2) if orders else 0.0,
        "daily": [{"date": str(d), "orders": n, "revenue": round(float(r), 2)} for d, n, r in daily],
        "top_products": [{"name": n or "—", "units": int(u or 0), "revenue": round(float(r or 0), 2)} for n, u, r in top_products],
        "top_buyers": [{"name": f"{fn} {ln}".strip(), "orders": n, "spent": round(float(s or 0), 2), "last_order": last}
                       for fn, ln, n, s, last in top_buyers],
        "negotiation": {_v(k): v for k, v in offers.items()},
        "messages": messages_total,
        "messages_by_source": dict(sources),
        "buyer_sentiment": dict(sentiment),
    }


@router.get("/customers")
async def customers(user=Depends(seller_only), db: AsyncSession = Depends(get_db)):
    """Buyers who have ordered from or messaged this seller, most valuable first."""
    seller = await _seller(db, user)
    rows = (await db.execute(
        select(BuyerProfile.id, BuyerProfile.first_name, BuyerProfile.last_name, BuyerProfile.city,
               func.count(Order.id), func.coalesce(func.sum(Order.total_amount), 0), func.max(Order.created_at))
        .join(Order, Order.buyer_id == BuyerProfile.id)
        .where(Order.seller_id == seller.id, Order.status.notin_(_NOT_REVENUE))
        .group_by(BuyerProfile.id).order_by(func.sum(Order.total_amount).desc())
    )).all()
    out = {bid: {"buyer_id": bid, "name": f"{fn} {ln}".strip(), "city": city, "orders": n,
                 "total_spent": round(float(spent), 2), "last_order_at": last, "has_conversation": False}
           for bid, fn, ln, city, n, spent, last in rows}
    try:
        async for convo in (await get_conversations_collection()).find({"sellerId": seller.id}, {"buyerId": 1}):
            bid = convo.get("buyerId")
            if bid in out:
                out[bid]["has_conversation"] = True
            elif bid is not None:
                buyer = await db.get(BuyerProfile, bid)
                if buyer:
                    out[bid] = {"buyer_id": bid, "name": f"{buyer.first_name} {buyer.last_name}".strip(),
                                "city": buyer.city, "orders": 0, "total_spent": 0.0, "last_order_at": None,
                                "has_conversation": True}
    except Exception:
        pass
    return list(out.values())
