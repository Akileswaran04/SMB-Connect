"""Discovery Service — catalogue search with filters and sorting (PRD §12–13).
Results carry everything a product card and the recommendation engine
need: effective price, delivery days, rating, seller trust and in-stock
sizes/colours."""
import hashlib
import json
from typing import Optional

from sqlalchemy import select, func, or_, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.redis import RedisClient
from app.modules.analytics.models import TrustScore
from app.modules.catalogue.pricing import unit_price
from app.modules.inventory.models import ProductVariant
from app.modules.orders.models import Review
from app.modules.seller_profile.models import Product, SellerProfile
from app.core.exceptions import NotFoundException

SORTS = ("relevance", "newest", "price_asc", "price_desc", "rating", "fastest")


def _v(value):
    return value.value if hasattr(value, "value") else value


class DiscoveryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _cache_key(params: dict) -> str:
        raw = json.dumps(params, sort_keys=True, default=str)
        return f"cache:discover:v2:{hashlib.sha256(raw.encode()).hexdigest()[:20]}"

    async def search_products(
        self,
        category: Optional[str] = None,
        location: Optional[str] = None,
        budget: Optional[float] = None,
        q: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        min_price: Optional[float] = None,
        seller_id: Optional[int] = None,
        in_stock: bool = False,
        max_delivery_days: Optional[int] = None,
        size: Optional[str] = None,
        color: Optional[str] = None,
        sort: str = "relevance",
        exclude_ids: Optional[list[int]] = None,
        only_ids: Optional[list[int]] = None,
    ) -> dict:
        params = {k: v for k, v in locals().items() if k != "self"}
        cache_key = self._cache_key(params)
        cached = await RedisClient.get_cache(cache_key)
        if cached is not None:
            return cached

        filters = [Product.status == "published"]
        if category:
            filters.append(func.lower(Product.category) == category.lower())
        if budget is not None and budget > 0:
            filters.append(func.coalesce(Product.sale_price, Product.price) <= budget)
        if min_price is not None and min_price > 0:
            filters.append(func.coalesce(Product.sale_price, Product.price) >= min_price)
        if q:
            # Light stemming so "shoes" still finds "Formal Shoe".
            words = [w[:-1] if len(w) > 3 and w.lower().endswith("s") else w
                     for w in q.split() if len(w) > 1][:6] or [q]
            filters.append(and_(*[
                or_(Product.name.ilike(f"%{w}%"), Product.description.ilike(f"%{w}%"), Product.category.ilike(f"%{w}%"))
                for w in words
            ]))
        if location:
            filters.append(SellerProfile.city.ilike(f"%{location}%"))
        if seller_id:
            filters.append(Product.seller_id == seller_id)
        if in_stock:
            filters.append(Product.stock > 0)
        if max_delivery_days:
            filters.append(Product.delivery_days <= max_delivery_days)
        if exclude_ids:
            filters.append(Product.id.notin_(exclude_ids))
        if only_ids:
            filters.append(Product.id.in_(only_ids))
        if size or color:
            variant_match = select(ProductVariant.product_id).where(
                ProductVariant.is_active.is_(True), ProductVariant.stock > 0,
                *([func.lower(ProductVariant.size) == size.lower()] if size else []),
                *([func.lower(ProductVariant.color) == color.lower()] if color else []),
            )
            if color and not size:
                # Plain products say their colour in the name/description.
                filters.append(or_(Product.id.in_(variant_match), Product.name.ilike(f"%{color}%"),
                                   Product.description.ilike(f"%{color}%")))
            else:
                filters.append(Product.id.in_(variant_match))

        ratings = (
            select(Review.product_id, func.avg(Review.rating).label("avg"), func.count(Review.id).label("n"))
            .group_by(Review.product_id).subquery()
        )
        effective = func.coalesce(Product.sale_price, Product.price)
        order_by = {
            "newest": [Product.created_at.desc()],
            "price_asc": [effective.asc()],
            "price_desc": [effective.desc()],
            "rating": [func.coalesce(ratings.c.avg, 0).desc(), func.coalesce(ratings.c.n, 0).desc()],
            "fastest": [Product.delivery_days.asc(), effective.asc()],
        }.get(sort, [case((Product.stock > 0, 0), else_=1), func.coalesce(TrustScore.overall_score, 0).desc(),
                     Product.likes.desc(), Product.created_at.desc()])

        base = (
            select(Product, SellerProfile.business_name, SellerProfile.city, SellerProfile.verification_status,
                   TrustScore.overall_score, ratings.c.avg, ratings.c.n)
            .join(SellerProfile, Product.seller_id == SellerProfile.id)
            .outerjoin(TrustScore, TrustScore.seller_id == SellerProfile.id)
            .outerjoin(ratings, ratings.c.product_id == Product.id)
            .where(*filters)
        )
        total = (await self.db.execute(
            select(func.count()).select_from(
                select(Product.id).join(SellerProfile, Product.seller_id == SellerProfile.id).where(*filters).subquery()
            )
        )).scalar() or 0
        rows = (await self.db.execute(base.order_by(*order_by).limit(limit).offset(offset))).all()

        variants: dict[int, list] = {}
        if rows:
            for v in (await self.db.execute(
                select(ProductVariant).where(ProductVariant.product_id.in_([r[0].id for r in rows]),
                                             ProductVariant.is_active.is_(True))
            )).scalars().all():
                variants.setdefault(v.product_id, []).append(v)

        items = []
        for product, seller_name, seller_city, v_status, trust_score, rating_avg, rating_n in rows:
            vs = variants.get(product.id, [])
            price = unit_price(product)
            items.append({
                "id": product.id,
                "name": product.name,
                "description": product.description,
                "category": product.category,
                "price": price["unit"],
                "listed_price": price["listed"],
                "discount_pct": price["discount_pct"],
                "image_url": product.image_url,
                "stock": product.stock,
                "seller_id": product.seller_id,
                "seller_name": seller_name,
                "seller_city": seller_city,
                "seller_verification_status": _v(v_status),
                "trust_score": round(trust_score, 1) if trust_score is not None else None,
                "rating": round(float(rating_avg), 1) if rating_avg is not None else None,
                "rating_count": rating_n or 0,
                "delivery_days": product.delivery_days,
                "express_available": product.express_available,
                "sizes": sorted({v.size for v in vs if v.size and v.stock > 0}),
                "colors": sorted({v.color for v in vs if v.color and v.stock > 0}),
                "has_variants": bool(vs),
            })

        payload = {
            "items": items,
            "total": total,
            "next_cursor": str(offset + len(items)) if offset + len(items) < total else None,
            "limit": limit,
        }
        await RedisClient.set_cache(cache_key, payload, ttl=30)
        return payload

    async def get_public_seller(self, seller_id: int) -> dict:
        profile = await self.db.get(SellerProfile, seller_id)
        if not profile:
            raise NotFoundException("Seller", str(seller_id))
        trust = (await self.db.execute(
            select(TrustScore.overall_score).where(TrustScore.seller_id == seller_id)
        )).scalar_one_or_none()
        product_count = (await self.db.execute(
            select(func.count(Product.id)).where(Product.seller_id == seller_id, Product.status == "published")
        )).scalar() or 0
        return {
            "id": profile.id,
            "business_name": profile.business_name,
            "business_type": profile.business_type,
            "description": profile.description,
            "city": profile.city,
            "country": profile.country,
            "verification_status": _v(profile.verification_status),
            "trust_score": round(trust, 1) if trust is not None else None,
            "product_count": product_count,
            "created_at": profile.created_at,
        }
