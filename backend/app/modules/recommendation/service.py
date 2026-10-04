"""Recommendation Service — ranks a candidate pool into 2-3 tagged, reasoned
picks (PRD §9, §10, §56) and compares products (PRD §17).

Ranking and every reason are computed from real data (price, budget, stock,
sizes, delivery days, ratings, seller trust, location, purchase history);
only the free-text comparison summary is written by the model, and it is
given nothing but those facts.
"""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.buyer_discovery.service import DiscoveryService
from app.modules.catalogue.pricing import same_city
from app.modules.recommendation.schemas import CompareRequest
from app.modules.seller_profile.models import Product
from app.core.ai import chat
from app.core.exceptions import ValidationException


def _inr(x: float) -> str:
    return f"₹{x:,.0f}"


def _days_text(days: int) -> str:
    return "Delivery tomorrow" if days <= 1 else f"Delivery in {days} days"


class RecommendationService:
    """Business logic for recommendations and comparisons."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.discovery = DiscoveryService(db)

    @staticmethod
    def _days(c: dict, ctx: dict) -> int:
        days = c.get("delivery_days") or 4
        return max(1, days - 1) if same_city(ctx.get("city"), c.get("seller_city")) else days

    def _reasons(self, c: dict, tag: str, ctx: dict, budget: Optional[float], size: Optional[str],
                 color: Optional[str], q: Optional[str], best: Optional[dict]) -> tuple[list[str], list[str]]:
        main, more = [], []
        days = self._days(c, ctx)
        if tag == "Better Value" and best:
            main.append(f"{_inr(best['price'] - c['price'])} less than the best fit")
        if tag == "Faster Delivery":
            main.append(_days_text(days))
        if tag == "Premium Option" and c.get("rating"):
            main.append(f"Top rated — {c['rating']}★ from {c['rating_count']} review{'s' if c['rating_count'] != 1 else ''}")
        if budget and c["price"] <= budget:
            main.append(f"Within your budget ({_inr(budget)})")
        if size and size.lower() in [s.lower() for s in c.get("sizes", [])]:
            main.append(f"Available in size {size}")
        if tag != "Faster Delivery":
            (main if days <= 2 else more).append(_days_text(days))
        if c.get("seller_verification_status") == "verified":
            main.append("Verified seller")
        if c["seller_id"] in ctx.get("previous_seller_ids", []):
            main.append("You've ordered from this seller before")
        elif c["seller_id"] in ctx.get("preferred_sellers", []):
            main.append("From one of your preferred sellers")
        if c.get("rating") and tag != "Premium Option":
            (main if c["rating"] >= 4 else more).append(f"Rated {c['rating']}★ ({c['rating_count']} reviews)")
        if color and color.lower() in (c["name"] + " " + (c.get("description") or "")).lower() + " ".join(c.get("colors", [])).lower():
            more.append(f"Comes in {color}")
        if q and any(w.lower().rstrip("s") in c["name"].lower() for w in q.split() if len(w) > 2):
            more.append(f"Strong match for “{q}”")
        if c.get("discount_pct"):
            more.append(f"{c['discount_pct']}% off the listed price")
        if c.get("trust_score") is not None:
            more.append(f"Seller trust score {round(c['trust_score'])}/100")
        if c.get("express_available") and days > 1:
            more.append("Express next-day delivery available")
        more.append(f"{c['stock']} in stock")
        seen, main_out = set(), []
        for r in main:
            if r not in seen:
                seen.add(r)
                main_out.append(r)
        return main_out[:4], [r for r in more if r not in seen] + main_out[4:]

    async def recommend(
        self,
        category: Optional[str] = None,
        budget: Optional[float] = None,
        q: Optional[str] = None,
        location: Optional[str] = None,
        priority: Optional[str] = None,
        size: Optional[str] = None,
        color: Optional[str] = None,
        context: Optional[dict] = None,
        exclude_ids: Optional[list[int]] = None,
    ) -> list[dict]:
        """2-3 relevant, reasoned picks — never a full list (PRD §9)."""
        ctx = context or {}
        search = dict(category=category, budget=budget, q=q, location=location, in_stock=True,
                      limit=40, offset=0, exclude_ids=exclude_ids)
        candidates = (await self.discovery.search_products(size=size, color=color, **search))["items"]
        if not candidates and color:
            candidates = (await self.discovery.search_products(size=size, **search))["items"]
        if not candidates and size:
            candidates = (await self.discovery.search_products(**search))["items"]
        candidates = [c for c in candidates if c["stock"] > 0]
        if not candidates:
            return []

        def best_fit_score(c: dict) -> float:
            score = (c.get("trust_score") or 50) * 0.3 + (c.get("rating") or 3.5) * 8
            score += 20 if budget is None or c["price"] <= budget else -50
            score -= 2 * self._days(c, ctx)
            if q and any(w.lower().rstrip("s") in c["name"].lower() for w in q.split() if len(w) > 2):
                score += 15
            if c["seller_id"] in ctx.get("preferred_sellers", []):
                score += 15
            if c["seller_id"] in ctx.get("previous_seller_ids", []):
                score += 10
            if c.get("seller_verification_status") == "verified":
                score += 5
            return score

        best = max(candidates, key=best_fit_score)
        picks: list[tuple[dict, str]] = [(best, "Best Fit")]
        rest = [c for c in candidates if c["id"] != best["id"]]

        cheaper = [c for c in rest if c["price"] < best["price"]]
        if cheaper:
            value = min(cheaper, key=lambda c: (c["price"], -best_fit_score(c)))
            picks.append((value, "Better Value"))
            rest = [c for c in rest if c["id"] != value["id"]]
        faster = [c for c in rest if self._days(c, ctx) < self._days(best, ctx)]
        if faster:
            fast = min(faster, key=lambda c: (self._days(c, ctx), c["price"]))
            picks.append((fast, "Faster Delivery"))
            rest = [c for c in rest if c["id"] != fast["id"]]
        premium_pool = [c for c in rest if (c.get("rating") or 0) >= (best.get("rating") or 0) and c["price"] >= best["price"]]
        if premium_pool and len(picks) < 3:
            premium = max(premium_pool, key=lambda c: ((c.get("rating") or 0), c["price"]))
            picks.append((premium, "Premium Option"))

        order = {"price": "Better Value", "delivery": "Faster Delivery", "quality": "Premium Option"}.get(priority)
        if order:
            picks.sort(key=lambda p: 0 if p[1] == order else 1)
        picks = picks[:3]

        items = []
        for c, tag in picks:
            reasons, more = self._reasons(c, tag, ctx, budget, size, color, q, best if tag != "Best Fit" else None)
            items.append({
                "product_id": c["id"], "name": c["name"], "price": c["price"], "listed_price": c.get("listed_price"),
                "discount_pct": c.get("discount_pct", 0), "image_url": c.get("image_url"), "category": c["category"],
                "stock": c["stock"], "seller_id": c["seller_id"], "seller_name": c.get("seller_name"),
                "trust_score": c.get("trust_score"), "rating": c.get("rating"), "rating_count": c.get("rating_count", 0),
                "delivery_days": self._days(c, ctx), "express_available": c.get("express_available", False),
                "sizes": c.get("sizes", []), "has_variants": c.get("has_variants", False),
                "tag": tag, "reasons": reasons, "more_reasons": more,
            })
        return items

    async def compare(self, data: CompareRequest, context: Optional[dict] = None) -> dict:
        ctx = context or {}
        found = {c["id"]: c for c in (await self.discovery.search_products(only_ids=data.product_ids, limit=10))["items"]}
        products = [found[pid] for pid in data.product_ids if pid in found]
        if len(products) < 2:
            raise ValidationException("Could not find enough of the selected products to compare")

        specs = {p.id: (p.specifications or {}, p.return_days) for p in (await self.db.execute(
            select(Product).where(Product.id.in_([p["id"] for p in products]))
        )).scalars().all()}
        table = []
        for p in products:
            spec, return_days = specs.get(p["id"], ({}, None))
            table.append({
                "product_id": p["id"], "name": p["name"], "price": p["price"], "listed_price": p.get("listed_price"),
                "delivery_days": self._days(p, ctx), "express_available": p.get("express_available", False),
                "rating": p.get("rating"), "rating_count": p.get("rating_count", 0),
                "trust_score": p.get("trust_score"),
                "seller_name": p.get("seller_name"), "verified_seller": p.get("seller_verification_status") == "verified",
                "stock": p["stock"], "sizes": p.get("sizes", []), "return_days": return_days,
                "specifications": spec,
            })

        cheapest = min(table, key=lambda r: r["price"])
        fastest = min(table, key=lambda r: r["delivery_days"])
        rated = max(table, key=lambda r: (r["rating"] or 0, r["rating_count"]))
        trusted = max(table, key=lambda r: r["trust_score"] or 0)
        differences = []
        if cheapest["price"] < max(r["price"] for r in table):
            differences.append(f"{cheapest['name']} is the cheapest at {_inr(cheapest['price'])}.")
        if len({r["delivery_days"] for r in table}) > 1:
            differences.append(f"{fastest['name']} arrives soonest ({_days_text(fastest['delivery_days']).lower()}).")
        if rated["rating"] and len({r["rating"] for r in table}) > 1:
            differences.append(f"{rated['name']} has the best reviews ({rated['rating']}★).")
        if trusted["trust_score"] and len({r["trust_score"] for r in table}) > 1:
            differences.append(f"{trusted['name']} comes from the most trusted seller.")
        spec_keys = sorted({k for r in table for k in r["specifications"]})
        for key in spec_keys[:4]:
            values = {r["name"]: r["specifications"].get(key) for r in table}
            if len(set(values.values())) > 1:
                differences.append(f"{key}: " + "; ".join(f"{n} — {v or 'not stated'}" for n, v in values.items()))

        facts = "\n".join(
            f"- {r['name']}: {_inr(r['price'])}, {_days_text(r['delivery_days']).lower()}, "
            f"rating {r['rating'] or 'none yet'}, seller trust {r['trust_score'] or 'n/a'}, "
            f"{r['stock']} in stock, specs {r['specifications'] or 'none listed'}"
            for r in table
        )
        summary = await chat(
            "You compare products for a shopper in 2-3 short sentences, like a helpful shopkeeper. Be concrete "
            "(price, delivery, quality/reviews, seller reliability, important spec differences), plain language, "
            "no markdown. Use ONLY the facts given; never invent features, materials or delivery times.",
            f"Compare these options:\n{facts}",
            temperature=0.4, max_tokens=220,
        )
        if not summary:
            summary = " ".join(differences[:3]) or f"{cheapest['name']} is {_inr(cheapest['price'])}."

        return {
            "summary": summary,
            "differences": differences,
            "best_for": {"price": cheapest["product_id"], "delivery": fastest["product_id"],
                         "quality": rated["product_id"], "seller_reliability": trusted["product_id"]},
            "table": table,
        }
