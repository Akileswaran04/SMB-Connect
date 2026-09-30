"""Buyer hub — preferences, personalisation and the personalised home
(PRD §7 returning users, §26–28, §64)."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_roles
from app.modules.buyer_profile.personalisation import PersonalisationService
from app.modules.catalogue.pricing import unit_price
from app.modules.inventory.models import ProductVariant
from app.modules.orders.models import Order, OrderItem
from app.modules.recommendation.service import RecommendationService
from app.modules.seller_profile.models import Product, SellerProfile

router = APIRouter()
buyer_only = require_roles("buyer")


def _v(value):
    return value.value if hasattr(value, "value") else value


@router.get("/me/preferences")
async def get_preferences(user=Depends(buyer_only), db: AsyncSession = Depends(get_db)):
    svc = PersonalisationService(db)
    return svc.preferences_of(await svc.buyer(user.id))


@router.put("/me/preferences")
async def update_preferences(changes: dict, user=Depends(buyer_only), db: AsyncSession = Depends(get_db)):
    """Sizes, colours, budgets, preferred sellers, delivery preference and
    notification / voice / privacy settings — all buyer-controlled."""
    return await PersonalisationService(db).update_preferences(user.id, changes)


@router.get("/me/personalisation")
async def personalisation(user=Depends(buyer_only), db: AsyncSession = Depends(get_db)):
    """What we remember: explicit preferences, learned patterns, and the result."""
    return await PersonalisationService(db).profile(user.id)


@router.get("/me/home")
async def home(user=Depends(buyer_only), db: AsyncSession = Depends(get_db)):
    svc = PersonalisationService(db)
    buyer = await svc.buyer(user.id)
    prof = await svc.profile(user.id)
    effective = prof["effective"]

    recent_orders = (await db.execute(
        select(Order).where(Order.buyer_id == buyer.id).order_by(Order.id.desc()).limit(5)
    )).scalars().all()
    recent = []
    for o in recent_orders:
        first = (await db.execute(select(OrderItem).where(OrderItem.order_id == o.id).limit(1))).scalar_one_or_none()
        image = (await db.execute(select(Product.image_url).where(Product.id == first.product_id))).scalar_one_or_none() if first else None
        recent.append({"order_id": o.id, "order_number": o.order_number, "status": _v(o.status),
                       "created_at": o.created_at, "total_amount": o.total_amount,
                       "title": first.product_name if first else None, "image_url": image})

    delivered_items = (await db.execute(
        select(OrderItem, Order.id, SellerProfile.business_name)
        .join(Order, Order.id == OrderItem.order_id)
        .join(SellerProfile, SellerProfile.id == Order.seller_id)
        .where(Order.buyer_id == buyer.id, Order.status.in_(("delivered", "return_requested")))
        .order_by(Order.id.desc()).limit(30)
    )).all()
    buy_again, seen = [], set()
    for item, order_id, seller_name in delivered_items:
        key = (item.product_id, item.variant_id)
        if key in seen:
            continue
        seen.add(key)
        product = await db.get(Product, item.product_id)
        variant = await db.get(ProductVariant, item.variant_id) if item.variant_id else None
        if not product or _v(product.status) != "published":
            continue
        stock = (variant or product).stock
        buy_again.append({
            "order_id": order_id, "product_id": product.id, "variant_id": item.variant_id,
            "name": product.name, "variant_label": item.variant_label, "image_url": product.image_url,
            "seller_name": seller_name, "last_quantity": item.quantity, "last_price": item.unit_price,
            "current_price": unit_price(product, variant, item.quantity)["unit"], "available": stock > 0,
        })
        if len(buy_again) >= 6:
            break

    categories = list(dict.fromkeys(list(effective.get("sizes", {})) + list(effective.get("budgets", {}))))
    bought_ids = list({i.product_id for i, _, _ in delivered_items})
    suggestions = []
    if prof["personalisation_enabled"]:
        for category in categories[:2]:
            suggestions += await RecommendationService(db).recommend(
                category=category, budget=effective["budgets"].get(category),
                size=effective["sizes"].get(category), context=effective, exclude_ids=bought_ids,
            )
    suggestions = list({s["product_id"]: s for s in suggestions}.values())[:3]

    hints = []
    for category, size in effective.get("sizes", {}).items():
        hints.append(f"You usually buy size {size} in {category}.")
    for category, budget in list(effective.get("budgets", {}).items())[:2]:
        hints.append(f"Your usual spend on {category} is around ₹{budget:,.0f}.")

    return {
        "first_name": buyer.first_name,
        "is_returning": bool(recent),
        "recent_purchases": recent,
        "buy_again": buy_again,
        "based_on_preferences": suggestions,
        "hints": hints[:3],
        "personalisation_enabled": prof["personalisation_enabled"],
    }
