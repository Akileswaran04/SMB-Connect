import hashlib
import json
from typing import Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.redis import RedisClient
from app.modules.seller_profile.models import Product, SellerProfile
from app.modules.analytics.models import TrustScore
from app.core.exceptions import NotFoundException


class DiscoveryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _cache_key(self, category: Optional[str], location: Optional[str],
                   budget: Optional[float], q: Optional[str], limit: int, offset: int) -> str:
        raw = json.dumps([category, location, budget, q, limit, offset])
        digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
        return f"cache:discover:{digest}"

    async def search_products(
        self,
        category: Optional[str] = None,
        location: Optional[str] = None,
        budget: Optional[float] = None,
        q: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        cache_key = self._cache_key(category, location, budget, q, limit, offset)
        cached = await RedisClient.get_cache(cache_key)
        if cached is not None:
            return cached

        filters = []
        if category:
            filters.append(Product.category == category)
        if budget is not None and budget > 0:
            filters.append(Product.price <= budget)
        if q:
            like = f"%{q}%"
            filters.append(
                or_(Product.name.ilike(like), Product.description.ilike(like))
            )
        if location:
            filters.append(SellerProfile.city.ilike(f"%{location}%"))

        count_result = await self.db.execute(
            select(func.count(Product.id)).select_from(Product).join(
                SellerProfile, Product.seller_id == SellerProfile.id
            ).where(*filters)
        )
        total = count_result.scalar() or 0

        result = await self.db.execute(
            select(
                Product,
                SellerProfile.business_name,
                SellerProfile.city,
                SellerProfile.verification_status,
                TrustScore.overall_score,
            )
            .join(SellerProfile, Product.seller_id == SellerProfile.id)
            .outerjoin(TrustScore, TrustScore.seller_id == SellerProfile.id)
            .where(*filters)
            .order_by(Product.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        items = []
        for row in result.all():
            product, seller_name, seller_city, v_status, trust_score = row
            items.append({
                "id": product.id,
                "name": product.name,
                "description": product.description,
                "category": product.category,
                "price": product.price,
                "image_url": product.image_url,
                "stock": product.stock,
                "seller_id": product.seller_id,
                "seller_name": seller_name,
                "seller_city": seller_city,
                "seller_verification_status": v_status.value if hasattr(v_status, "value") else v_status,
                "trust_score": round(trust_score, 1) if trust_score is not None else None,
            })

        payload = {
            "items": items,
            "total": total,
            "next_cursor": str(offset + len(items)) if offset + len(items) < total else None,
            "limit": limit,
        }

        await RedisClient.set_cache(cache_key, payload, ttl=60)
        return payload

    async def get_public_seller(self, seller_id: int) -> dict:
        result = await self.db.execute(
            select(
                SellerProfile,
                TrustScore.overall_score,
                func.count(Product.id),
            )
            .outerjoin(TrustScore, TrustScore.seller_id == SellerProfile.id)
            .outerjoin(Product, Product.seller_id == SellerProfile.id)
            .where(SellerProfile.id == seller_id)
            .group_by(SellerProfile.id, TrustScore.id)
        )
        row = result.first()
        if not row:
            raise NotFoundException("Seller", str(seller_id))

        profile, trust_score, product_count = row
        return {
            "id": profile.id,
            "business_name": profile.business_name,
            "business_type": profile.business_type,
            "description": profile.description,
            "city": profile.city,
            "country": profile.country,
            "verification_status": profile.verification_status.value if hasattr(profile.verification_status, "value") else profile.verification_status,
            "trust_score": round(trust_score, 1) if trust_score is not None else None,
            "product_count": product_count,
            "created_at": profile.created_at,
        }