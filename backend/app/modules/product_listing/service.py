"""Product Service — seller catalogue management (PRD §32–34) and the public
product page (PRD §11): variants, pricing, delivery/return info, reviews,
trust signals and reporting."""
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.analytics.models import TrustScore
from app.modules.buyer_profile.models import BuyerProfile
from app.modules.catalogue.models import ProductReport
from app.modules.catalogue.pricing import unit_price, delivery_days, same_city
from app.modules.inventory.models import ProductVariant
from app.modules.inventory.service import InventoryService
from app.modules.negotiation.models import NegotiationRule
from app.modules.orders.models import Review, OrderItem, Order
from app.modules.product_listing.repository import ProductRepository
from app.modules.product_listing.schemas import (
    ProductCreate, ProductUpdate, ReviewCreate, ReviewReply, VariantCreate, VariantUpdate,
)
from app.modules.seller_profile.models import SellerProfile, Product
from app.core.exceptions import NotFoundException, ValidationException, ForbiddenException


def _status(value) -> str:
    return value.value if hasattr(value, "value") else value


def serialize_variant(v: ProductVariant, product: Optional[Product] = None) -> dict:
    return {
        "id": v.id, "product_id": v.product_id, "size": v.size, "color": v.color, "sku": v.sku,
        "price": v.price,
        "effective_price": unit_price(product, v)["unit"] if product is not None else v.price,
        "stock": v.stock, "reserved_stock": v.reserved_stock, "incoming_stock": v.incoming_stock,
        "is_active": v.is_active, "label": v.label,
    }


def serialize_product(p: Product, variants: Optional[list] = None, include_inactive: bool = False) -> dict:
    variants = variants if variants is not None else list(p.variants or [])
    return {
        "id": p.id, "seller_id": p.seller_id, "name": p.name, "description": p.description,
        "category": p.category, "price": p.price, "image_url": p.image_url, "images": p.images or [],
        "sku": p.sku, "status": _status(p.status), "stock": p.stock, "reserved_stock": p.reserved_stock or 0,
        "incoming_stock": p.incoming_stock or 0, "low_stock_threshold": p.low_stock_threshold, "likes": p.likes,
        "sale_price": p.sale_price, "promo_price": p.promo_price, "promo_ends_at": p.promo_ends_at,
        "bulk_pricing": p.bulk_pricing or [], "delivery_days": p.delivery_days,
        "express_available": p.express_available, "return_days": p.return_days,
        "return_policy": p.return_policy, "specifications": p.specifications or {},
        "price_info": unit_price(p),
        "variants": [serialize_variant(v, p) for v in variants if include_inactive or v.is_active],
        "created_at": p.created_at, "updated_at": p.updated_at,
    }


class ProductService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.product_repo = ProductRepository(db)

    async def _get_seller_id_from_user(self, user_id: int) -> int:
        profile = (await self.db.execute(select(SellerProfile).where(SellerProfile.user_id == user_id))).scalar_one_or_none()
        if not profile:
            raise ForbiddenException("Only sellers can manage products")
        return profile.id

    async def _get_product_or_404(self, product_id: int) -> Product:
        product = await self.product_repo.get_by_id(product_id)
        if not product:
            raise NotFoundException("Product", str(product_id))
        return product

    async def _assert_owns_product(self, user_id: int, product) -> None:
        if product.seller_id != await self._get_seller_id_from_user(user_id):
            raise ForbiddenException("You do not own this product")

    async def _variants(self, product_id: int) -> list[ProductVariant]:
        return list((await self.db.execute(
            select(ProductVariant).where(ProductVariant.product_id == product_id).order_by(ProductVariant.id)
        )).scalars().all())

    async def _serialize(self, product: Product) -> dict:
        return serialize_product(product, await self._variants(product.id), include_inactive=True)

    @staticmethod
    def _clean_payload(data: dict) -> dict:
        if data.get("bulk_pricing") is not None:
            data["bulk_pricing"] = [dict(t) for t in data["bulk_pricing"]]
        return data

    # ── Seller: catalogue management ──

    async def create_product(self, user_id: int, data: ProductCreate) -> dict:
        seller_id = await self._get_seller_id_from_user(user_id)
        payload = self._clean_payload(data.model_dump(exclude_unset=True, exclude={"variants"}))
        if data.sale_price and data.sale_price >= data.price:
            raise ValidationException("Sale price must be lower than the listed price")
        if data.variants:
            payload["stock"] = sum(v.stock for v in data.variants)
        product = await self.product_repo.create(seller_id=seller_id, data=payload)
        for v in data.variants or []:
            self.db.add(ProductVariant(product_id=product.id, **v.model_dump()))
        await self.db.flush()
        await self.db.refresh(product)
        return await self._serialize(product)

    async def get_product(self, product_id: int, viewer=None) -> dict:
        product = await self._get_product_or_404(product_id)
        await self._assert_visible(product, viewer)
        return await self._serialize(product)

    async def _assert_visible(self, product: Product, viewer) -> None:
        if _status(product.status) == "published":
            return
        if viewer is not None and viewer.role == "admin":
            return
        if viewer is not None and viewer.role == "seller":
            if product.seller_id == await self._get_seller_id_from_user(viewer.id):
                return
        raise NotFoundException("Product", str(product.id))

    async def get_products_by_seller(self, user_id: int, limit: int = 100, offset: int = 0,
                                     include_archived: bool = True) -> dict:
        seller_id = await self._get_seller_id_from_user(user_id)
        items, has_more = await self.product_repo.get_by_seller(seller_id, limit=limit, offset=offset,
                                                                include_archived=include_archived)
        variants: dict[int, list] = {}
        if items:
            for v in (await self.db.execute(
                select(ProductVariant).where(ProductVariant.product_id.in_([p.id for p in items])).order_by(ProductVariant.id)
            )).scalars().all():
                variants.setdefault(v.product_id, []).append(v)
        return {
            "items": [serialize_product(p, variants.get(p.id, []), include_inactive=True) for p in items],
            "has_more": has_more, "limit": limit, "offset": offset,
        }

    async def get_public_seller_products(self, seller_id: int, limit: int = 100, offset: int = 0) -> list:
        result = await self.db.execute(
            select(Product)
            .where(Product.seller_id == seller_id, Product.status == "published")
            .order_by(Product.created_at.desc()).limit(limit).offset(offset)
        )
        return [serialize_product(p, []) for p in result.scalars().all()]

    async def update_product(self, user_id: int, product_id: int, data: ProductUpdate) -> dict:
        product = await self._get_product_or_404(product_id)
        await self._assert_owns_product(user_id, product)
        if _status(product.status) == "deleted":
            raise ForbiddenException("This product was removed by moderation")
        update_data = self._clean_payload(data.model_dump(exclude_unset=True))
        new_price = update_data.get("price", product.price)
        sale = update_data.get("sale_price", product.sale_price)
        if sale and sale >= new_price:
            raise ValidationException("Sale price must be lower than the listed price")
        update_data["updated_at"] = datetime.utcnow()
        await self.product_repo.update(product_id, update_data)
        await self.db.refresh(product)
        return await self._serialize(product)

    async def delete_product(self, user_id: int, product_id: int) -> dict:
        """PRD §32 delete/archive: products with order history are archived so
        past orders stay intact; unused products are deleted."""
        product = await self._get_product_or_404(product_id)
        await self._assert_owns_product(user_id, product)
        has_orders = (await self.db.execute(
            select(OrderItem.id).where(OrderItem.product_id == product_id).limit(1)
        )).scalar_one_or_none() is not None
        if has_orders:
            product.status = "archived"
            product.updated_at = datetime.utcnow()
            await self.db.flush()
            return {"archived": True, "deleted": False}
        await self.product_repo.delete(product_id)
        return {"archived": False, "deleted": True}

    async def adjust_stock(self, user_id: int, product_id: int, delta: int, variant_id: Optional[int] = None,
                           note: Optional[str] = None) -> dict:
        product = await self._get_product_or_404(product_id)
        await self._assert_owns_product(user_id, product)
        await InventoryService(self.db, user_id).adjust(product_id, variant_id, delta, note)
        await self.db.flush()
        await self.db.refresh(product)
        return await self._serialize(product)

    # ── Seller: variants ──

    async def add_variant(self, user_id: int, product_id: int, data: VariantCreate) -> dict:
        product = await self._get_product_or_404(product_id)
        await self._assert_owns_product(user_id, product)
        if product.reserved_stock and not await InventoryService(self.db).has_variants(product_id):
            # Once variants exist the product's stock is their total, so open
            # orders against the plain product must ship first.
            raise ValidationException("Wait for open orders to ship before adding variants")
        variant = ProductVariant(product_id=product_id, **data.model_dump())
        self.db.add(variant)
        await self.db.flush()
        await InventoryService(self.db, user_id).sync_product_totals(product)
        await self.db.flush()
        return await self._serialize(product)

    async def update_variant(self, user_id: int, product_id: int, variant_id: int, data: VariantUpdate) -> dict:
        product = await self._get_product_or_404(product_id)
        await self._assert_owns_product(user_id, product)
        variant = await self.db.get(ProductVariant, variant_id)
        if not variant or variant.product_id != product_id:
            raise NotFoundException("ProductVariant", str(variant_id))
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(variant, key, value)
        await self.db.flush()
        await InventoryService(self.db, user_id).sync_product_totals(product)
        await self.db.flush()
        return await self._serialize(product)

    async def delete_variant(self, user_id: int, product_id: int, variant_id: int) -> dict:
        product = await self._get_product_or_404(product_id)
        await self._assert_owns_product(user_id, product)
        variant = await self.db.get(ProductVariant, variant_id)
        if not variant or variant.product_id != product_id:
            raise NotFoundException("ProductVariant", str(variant_id))
        if variant.reserved_stock:
            raise ValidationException("This variant has open orders — deactivate it instead")
        used = (await self.db.execute(select(OrderItem.id).where(OrderItem.variant_id == variant_id).limit(1))).scalar_one_or_none()
        if used is not None:
            variant.is_active = False
        else:
            await self.db.delete(variant)
        await self.db.flush()
        await InventoryService(self.db, user_id).sync_product_totals(product)
        await self.db.flush()
        return await self._serialize(product)

    # ── Public product page ──

    async def get_details(self, product_id: int, viewer=None) -> dict:
        """Everything the product page needs, most important first (PRD §11)."""
        product = await self._get_product_or_404(product_id)
        await self._assert_visible(product, viewer)
        variants = [v for v in await self._variants(product_id) if v.is_active]
        seller, trust = (await self.db.execute(
            select(SellerProfile, TrustScore.overall_score)
            .outerjoin(TrustScore, TrustScore.seller_id == SellerProfile.id)
            .where(SellerProfile.id == product.seller_id)
        )).first()
        rating_avg, rating_count = (await self.db.execute(
            select(func.avg(Review.rating), func.count(Review.id)).where(Review.product_id == product_id)
        )).one()
        buyer_city = None
        if viewer is not None and viewer.role == "buyer":
            buyer_city = (await self.db.execute(
                select(BuyerProfile.city).where(BuyerProfile.user_id == viewer.id)
            )).scalar_one_or_none()
        local = same_city(buyer_city, seller.city)
        rule = (await self.db.execute(select(NegotiationRule).where(NegotiationRule.product_id == product_id))).scalar_one_or_none()
        now = datetime.utcnow()
        std_days = delivery_days(product, local)
        data = serialize_product(product, variants)
        data.update({
            "available": product.stock > 0,
            "seller": {
                "id": seller.id, "business_name": seller.business_name, "city": seller.city,
                "verification_status": _status(seller.verification_status),
                "trust_score": round(trust, 1) if trust is not None else None,
                "member_since": seller.created_at,
            },
            "rating": {"average": round(float(rating_avg), 1) if rating_avg else None, "count": rating_count},
            "reviews": (await self.get_reviews(product_id))[:5],
            "delivery": {
                "standard_days": std_days,
                "standard_date": now.replace(hour=20, minute=0, second=0, microsecond=0) + timedelta(days=std_days),
                "express_available": product.express_available,
                "same_city": local,
            },
            "negotiation_enabled": bool(rule and rule.enabled),
            "return_summary": (f"{product.return_days}-day return" if product.return_days else "No returns")
                              + (f" — {product.return_policy}" if product.return_policy else ""),
        })
        return data

    async def toggle_like(self, product_id: int) -> dict:
        product = await self._get_product_or_404(product_id)
        new_likes = product.likes + 1
        await self.product_repo.update(product_id, {"likes": new_likes})
        return {"likes": new_likes, "liked": True}

    async def report(self, user_id: int, product_id: int, reason: str) -> dict:
        await self._get_product_or_404(product_id)
        report = ProductReport(product_id=product_id, reporter_user_id=user_id, reason=reason)
        self.db.add(report)
        await self.db.flush()
        return {"id": report.id, "status": report.status}

    # ── Reviews ──

    async def add_review(self, user_id: int, product_id: int, data: ReviewCreate) -> dict:
        product = await self._get_product_or_404(product_id)
        buyer = (await self.db.execute(select(BuyerProfile).where(BuyerProfile.user_id == user_id))).scalar_one_or_none()
        if not buyer:
            raise ForbiddenException("Only buyers can leave reviews")
        delivered = (await self.db.execute(
            select(OrderItem.id).join(OrderItem.order)
            .where(OrderItem.product_id == product_id, Order.buyer_id == buyer.id, Order.status == "delivered")
            .limit(1)
        )).scalar_one_or_none() is not None
        review = Review(product_id=product_id, buyer_id=buyer.id, seller_id=product.seller_id,
                        rating=data.rating, title=data.title, comment=data.comment,
                        is_verified_purchase=delivered)
        self.db.add(review)
        await self.db.flush()
        await self.db.refresh(review)
        return self._review_dict(review, f"{buyer.first_name} {buyer.last_name}".strip())

    @staticmethod
    def _review_dict(r: Review, name: Optional[str]) -> dict:
        return {"id": r.id, "product_id": r.product_id, "customer_name": name or "Buyer", "rating": r.rating,
                "title": r.title, "comment": r.comment, "seller_reply": r.seller_reply,
                "is_verified_purchase": r.is_verified_purchase, "created_at": r.created_at}

    async def get_reviews(self, product_id: int) -> list:
        rows = (await self.db.execute(
            select(Review, BuyerProfile.first_name, BuyerProfile.last_name)
            .outerjoin(BuyerProfile, Review.buyer_id == BuyerProfile.id)
            .where(Review.product_id == product_id)
            .order_by(Review.created_at.desc())
        )).all()
        return [self._review_dict(r, f"{fn or ''} {(ln or '')[:1]}".strip()) for r, fn, ln in rows]

    async def reply_to_review(self, user_id: int, review_id: int, data: ReviewReply) -> dict:
        review = (await self.db.execute(select(Review).where(Review.id == review_id))).scalar_one_or_none()
        if not review:
            raise NotFoundException("Review", str(review_id))
        product = await self._get_product_or_404(review.product_id)
        await self._assert_owns_product(user_id, product)
        review.seller_reply = data.seller_reply
        await self.db.flush()
        return self._review_dict(review, None)
