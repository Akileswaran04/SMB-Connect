"""Pricing and delivery rules — pure functions shared by product pages, cart,
checkout, recommendations and the assistant, so every screen quotes the same
price and delivery date."""
from datetime import datetime, timedelta
from typing import Optional


def unit_price(product, variant=None, quantity: int = 1, now: Optional[datetime] = None) -> dict:
    """Best price for `quantity` units. Listed price comes from the variant
    when it has its own price; product-level sale/promo prices only apply to
    the product price; bulk tiers apply whenever they are lower."""
    now = now or datetime.utcnow()
    listed = variant.price if variant is not None and variant.price else product.price
    price, reason = listed, None

    if variant is None or not variant.price:
        promo_live = product.promo_price and (product.promo_ends_at is None or product.promo_ends_at > now)
        if promo_live and product.promo_price < price:
            price, reason = product.promo_price, "promo"
        if product.sale_price and product.sale_price < price:
            price, reason = product.sale_price, "sale"

    for tier in sorted(product.bulk_pricing or [], key=lambda t: t.get("min_qty", 0)):
        try:
            min_qty, tier_price = int(tier["min_qty"]), float(tier["unit_price"])
        except (KeyError, TypeError, ValueError):
            continue
        if quantity >= min_qty and tier_price < price:
            price, reason = tier_price, "bulk"

    price = round(price, 2)
    return {
        "listed": round(listed, 2),
        "unit": price,
        "discount_per_unit": round(listed - price, 2),
        "discount_pct": round((listed - price) / listed * 100) if listed else 0,
        "reason": reason,
    }


def delivery_days(product, same_city: bool = False, option: str = "standard") -> int:
    """Days until delivery. Express is next-day where the seller offers it;
    a seller in the buyer's own city saves a day on standard delivery."""
    if option == "express" and product.express_available:
        return 1
    days = product.delivery_days or 4
    return max(1, days - 1) if same_city else days


def delivery_quote(products: list, items_total: float, settings: dict, option: str = "standard",
                   same_city: bool = False, now: Optional[datetime] = None) -> dict:
    """Charge and expected date for a group of products shipped together."""
    now = now or datetime.utcnow()
    express_ok = bool(products) and all(p.express_available for p in products)
    if option == "express" and not express_ok:
        option = "standard"
    days = max((delivery_days(p, same_city, option) for p in products), default=4)
    if option == "express":
        charge = float(settings["express_delivery_fee"])
    else:
        charge = 0.0 if items_total >= float(settings["free_delivery_threshold"]) else float(settings["standard_delivery_fee"])
    return {
        "option": option,
        "express_available": express_ok,
        "days": days,
        "charge": round(charge, 2),
        "expected_date": (now + timedelta(days=days)).replace(hour=20, minute=0, second=0, microsecond=0),
    }


def same_city(a: Optional[str], b: Optional[str]) -> bool:
    return bool(a and b and a.strip().lower() == b.strip().lower())
