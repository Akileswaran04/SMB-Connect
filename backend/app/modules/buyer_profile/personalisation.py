"""Personalisation — buyer-controlled preferences plus patterns learned from
order history (PRD §26–28, §64). Learned signals are computed on demand
from orders, so there is nothing hidden to delete: switching off
personalisation in privacy settings stops them being used at once."""
import copy
from collections import Counter, defaultdict
from statistics import median
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenException, ValidationException
from app.modules.buyer_profile.models import BuyerProfile
from app.modules.inventory.models import ProductVariant
from app.modules.orders.models import Order, OrderItem
from app.modules.seller_profile.models import Product, SellerProfile

DEFAULT_PREFERENCES: dict = {
    "sizes": {},                 # {"Footwear": "9"}
    "colors": [],                # ["black"]
    "budgets": {},               # {"Footwear": 1500}
    "preferred_sellers": [],     # seller ids
    "delivery_preference": None,  # "standard" | "express"
    "notification_settings": {"email": True, "sms": True, "whatsapp": False, "push": True},
    "voice_settings": {"auto_speak": True, "voice_language": None},
    "privacy_settings": {"personalisation": True, "save_voice_history": True},
}
_COUNTED = ("cancelled", "refunded", "returned")


def _merge(base: dict, changes: dict) -> dict:
    out = copy.deepcopy(base)
    for key, value in changes.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], value)
        else:
            out[key] = value
    return out


def _validate(prefs: dict) -> dict:
    if not isinstance(prefs.get("sizes"), dict) or not all(isinstance(v, (str, int)) for v in prefs["sizes"].values()):
        raise ValidationException("sizes must map a category to a size")
    prefs["sizes"] = {str(k)[:60]: str(v)[:20] for k, v in prefs["sizes"].items() if str(v).strip()}
    if not isinstance(prefs.get("colors"), list):
        raise ValidationException("colors must be a list")
    prefs["colors"] = [str(c).lower()[:30] for c in prefs["colors"]][:10]
    budgets = {}
    for k, v in (prefs.get("budgets") or {}).items():
        try:
            if v not in (None, ""):
                budgets[str(k)[:60]] = float(v)
        except (TypeError, ValueError):
            raise ValidationException("budgets must be numbers")
    prefs["budgets"] = budgets
    prefs["preferred_sellers"] = [int(s) for s in prefs.get("preferred_sellers") or []][:20]
    if prefs.get("delivery_preference") not in (None, "standard", "express"):
        raise ValidationException("delivery_preference must be standard or express")
    for group in ("notification_settings", "voice_settings", "privacy_settings"):
        if not isinstance(prefs.get(group), dict):
            raise ValidationException(f"{group} must be an object")
    return prefs


class PersonalisationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def buyer(self, user_id: int) -> BuyerProfile:
        buyer = (await self.db.execute(select(BuyerProfile).where(BuyerProfile.user_id == user_id))).scalar_one_or_none()
        if not buyer:
            raise ForbiddenException("Only buyers have preferences")
        return buyer

    @staticmethod
    def preferences_of(buyer: BuyerProfile) -> dict:
        return _merge(DEFAULT_PREFERENCES, buyer.preferences or {})

    async def update_preferences(self, user_id: int, changes: dict) -> dict:
        buyer = await self.buyer(user_id)
        unknown = set(changes) - set(DEFAULT_PREFERENCES)
        if unknown:
            raise ValidationException(f"Unknown preference(s): {', '.join(sorted(unknown))}")
        # Lists and the per-category maps are replaced as a whole so the buyer
        # can remove entries; settings groups are merged key by key.
        prefs = self.preferences_of(buyer)
        for key, value in changes.items():
            if key in ("notification_settings", "voice_settings", "privacy_settings") and isinstance(value, dict):
                prefs[key] = {**prefs[key], **value}
            else:
                prefs[key] = value
        buyer.preferences = _validate(prefs)
        await self.db.flush()
        return buyer.preferences

    async def learned(self, buyer_id: int) -> dict:
        rows = (await self.db.execute(
            select(OrderItem, Order.seller_id, Order.delivery_option, Order.created_at, Product.category,
                   ProductVariant.size, ProductVariant.color)
            .join(Order, Order.id == OrderItem.order_id)
            .join(Product, Product.id == OrderItem.product_id)
            .outerjoin(ProductVariant, ProductVariant.id == OrderItem.variant_id)
            .where(Order.buyer_id == buyer_id, Order.status.notin_(_COUNTED))
            .order_by(Order.created_at.desc())
        )).all()
        sizes, prices, colors, sellers, options, products = (defaultdict(Counter), defaultdict(list), Counter(),
                                                             Counter(), Counter(), Counter())
        names = {}
        orders = set()
        for item, seller_id, option, _created, category, size, color in rows:
            orders.add(item.order_id)
            if size:
                sizes[category][size] += item.quantity
            if color:
                colors[color.lower()] += item.quantity
            prices[category].append(item.unit_price)
            sellers[seller_id] += 1
            options[option or "standard"] += 1
            products[item.product_id] += item.quantity
            names[item.product_id] = item.product_name
        seller_names = dict((await self.db.execute(
            select(SellerProfile.id, SellerProfile.business_name).where(SellerProfile.id.in_(sellers.keys()))
        )).all()) if sellers else {}
        return {
            "orders_count": len(orders),
            "sizes": {cat: c.most_common(1)[0][0] for cat, c in sizes.items()},
            "colors": [c for c, _ in colors.most_common(3)],
            "budgets": {cat: round(median(p)) for cat, p in prices.items() if p},
            "preferred_sellers": [{"id": s, "name": seller_names.get(s), "orders": n} for s, n in sellers.most_common(3)],
            "delivery_preference": options.most_common(1)[0][0] if options else None,
            "frequent_products": [{"product_id": pid, "name": names.get(pid), "quantity": q}
                                  for pid, q in products.most_common(5) if q >= 2],
        }

    async def profile(self, user_id: int) -> dict:
        """Explicit preferences, learned patterns, and the effective result
        (explicit always wins)."""
        buyer = await self.buyer(user_id)
        prefs = self.preferences_of(buyer)
        enabled = bool(prefs["privacy_settings"].get("personalisation", True))
        learned = await self.learned(buyer.id) if enabled else None
        effective = {
            "sizes": {**(learned or {}).get("sizes", {}), **prefs["sizes"]},
            "colors": prefs["colors"] or (learned or {}).get("colors", []),
            "budgets": {**(learned or {}).get("budgets", {}), **prefs["budgets"]},
            "preferred_sellers": prefs["preferred_sellers"] or [s["id"] for s in (learned or {}).get("preferred_sellers", [])],
            "delivery_preference": prefs["delivery_preference"] or (learned or {}).get("delivery_preference"),
            "previous_seller_ids": [s["id"] for s in (learned or {}).get("preferred_sellers", [])],
            "city": buyer.city,
        }
        return {"personalisation_enabled": enabled, "explicit": prefs, "learned": learned, "effective": effective}

    @staticmethod
    def size_hint(effective: dict, category: Optional[str]) -> Optional[str]:
        if not category:
            return None
        size = next((v for k, v in effective.get("sizes", {}).items() if k.lower() == category.lower()), None)
        return size
