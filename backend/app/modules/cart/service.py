"""Cart Service — cart lines with variants and negotiated prices, the full
price breakdown (PRD §20), and checkout (delegates order creation to
OrderService so pricing, stock reservation, payment and tracking logic live
in exactly one place). Checkout runs in one transaction: if any seller's
order fails, nothing is charged or reserved."""
from collections import defaultdict
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.cart.repository import CartRepository
from app.modules.cart.models import CartItem
from app.modules.cart.schemas import CartItemCreate, CartItemUpdate, CheckoutRequest
from app.modules.buyer_profile.models import BuyerProfile, Address
from app.modules.catalogue.pricing import unit_price, delivery_quote, same_city
from app.modules.inventory.models import ProductVariant
from app.modules.negotiation.models import NegotiationOffer
from app.modules.orders.service import OrderService
from app.modules.orders.schemas import OrderCreate, OrderItemCreate
from app.modules.platform.service import PlatformSettingsService
from app.modules.seller_profile.models import Product, SellerProfile
from app.core.exceptions import NotFoundException, ForbiddenException, ValidationException


def _status(value) -> str:
    return value.value if hasattr(value, "value") else value


class CartService:
    """Business logic for the buyer's cart and checkout."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CartRepository(db)

    async def _buyer(self, user_id: int) -> BuyerProfile:
        profile = (await self.db.execute(select(BuyerProfile).where(BuyerProfile.user_id == user_id))).scalar_one_or_none()
        if not profile:
            raise ForbiddenException("Only buyers have a cart")
        return profile

    async def _check_variant(self, product: Product, variant_id: Optional[int]) -> Optional[ProductVariant]:
        has_variants = (await self.db.execute(
            select(ProductVariant.id).where(ProductVariant.product_id == product.id, ProductVariant.is_active.is_(True)).limit(1)
        )).scalar_one_or_none() is not None
        if variant_id is None:
            if has_variants:
                raise ValidationException(f"Choose a size/colour for '{product.name}'")
            return None
        variant = await self.db.get(ProductVariant, variant_id)
        if not variant or variant.product_id != product.id or not variant.is_active:
            raise ValidationException("That option is not available")
        return variant

    async def _accepted_offer(self, buyer_id: int, offer_id: int) -> NegotiationOffer:
        offer = await self.db.get(NegotiationOffer, offer_id)
        if not offer or offer.buyer_id != buyer_id:
            raise NotFoundException("NegotiationOffer", str(offer_id))
        if _status(offer.status) != "accepted":
            raise ValidationException("Only an accepted offer can be added to the cart")
        if offer.fulfilled_order_id is not None:
            raise ValidationException("This offer has already been used for an order")
        return offer

    # ── Reads ──

    async def get_cart(self, user_id: int, delivery_option: str = "standard") -> dict:
        buyer = await self._buyer(user_id)
        cart = await self.repo.get_or_create(buyer.id)
        items = await self.repo.list_items(cart.id)
        return await self._to_response(cart.id, items, buyer, delivery_option)

    async def _to_response(self, cart_id: int, items: list[CartItem], buyer: BuyerProfile, delivery_option: str) -> dict:
        settings = await PlatformSettingsService(self.db).get_all()
        seller_ids = {i.product.seller_id for i in items if i.product}
        sellers = {s.id: s for s in (await self.db.execute(
            select(SellerProfile).where(SellerProfile.id.in_(seller_ids))
        )).scalars().all()} if seller_ids else {}

        lines, by_seller = [], defaultdict(list)
        for item in items:
            product, variant = item.product, item.variant
            if product is None:
                continue
            price = unit_price(product, variant, item.quantity)
            offer_ok = item.offer is not None and _status(item.offer.status) == "accepted" and item.offer.fulfilled_order_id is None
            unit = item.offer.offered_price if offer_ok else price["unit"]
            reason = "negotiated" if offer_ok else price["reason"]
            stock = (variant or product).stock
            available = _status(product.status) == "published" and stock >= item.quantity and (variant is None or variant.is_active)
            line = {
                "id": item.id, "product_id": product.id, "variant_id": item.variant_id,
                "offer_id": item.offer_id if offer_ok else None,
                "product_name": product.name, "variant_label": variant.label if variant else None,
                "product_image_url": product.image_url, "seller_id": product.seller_id,
                "seller_name": sellers.get(product.seller_id).business_name if sellers.get(product.seller_id) else None,
                "listed_unit_price": price["listed"], "unit_price": round(unit, 2), "price_reason": reason,
                "available_stock": stock, "available": available, "quantity": item.quantity,
                "line_total": round(unit * item.quantity, 2),
                "line_discount": round((price["listed"] - unit) * item.quantity, 2),
                "added_at": item.added_at,
            }
            lines.append(line)
            by_seller[product.seller_id].append((line, product))

        groups, delivery_total = [], 0.0
        for seller_id, entries in by_seller.items():
            items_total = sum(line["line_total"] for line, _ in entries)
            seller = sellers.get(seller_id)
            quote = delivery_quote([p for _, p in entries], items_total, settings, delivery_option,
                                   same_city(buyer.city, seller.city if seller else None))
            delivery_total += quote["charge"]
            groups.append({"seller_id": seller_id, "seller_name": seller.business_name if seller else None,
                           "items_total": round(items_total, 2), "delivery": quote})

        subtotal = sum(line["listed_unit_price"] * line["quantity"] for line in lines)
        items_total = sum(line["line_total"] for line in lines)
        return {
            "id": cart_id,
            "items": lines,
            "groups": groups,
            "delivery_option": delivery_option,
            "subtotal": round(subtotal, 2),
            "discount_total": round(subtotal - items_total, 2),
            "items_total": round(items_total, 2),
            "delivery_total": round(delivery_total, 2),
            "total": round(items_total + delivery_total, 2),
            "item_count": sum(line["quantity"] for line in lines),
        }

    # ── Writes ──

    async def add_item(self, user_id: int, data: CartItemCreate) -> dict:
        buyer = await self._buyer(user_id)
        cart = await self.repo.get_or_create(buyer.id)

        offer = None
        product_id, quantity = data.product_id, data.quantity
        if data.offer_id is not None:
            offer = await self._accepted_offer(buyer.id, data.offer_id)
            product_id, quantity = offer.product_id, offer.quantity
        if product_id is None:
            raise ValidationException("product_id or offer_id is required")

        product = await self.db.get(Product, product_id)
        if not product or _status(product.status) != "published":
            raise NotFoundException("Product", str(product_id))
        variant = await self._check_variant(product, data.variant_id)
        stock = (variant or product).stock

        existing = await self.repo.get_line(cart.id, product.id, data.variant_id)
        if offer is not None:
            if stock < quantity:
                raise ValidationException(f"Only {stock} of '{product.name}' in stock")
            if existing:
                existing.quantity, existing.offer_id = quantity, offer.id
            else:
                await self.repo.add(CartItem(cart_id=cart.id, product_id=product.id, variant_id=data.variant_id,
                                             quantity=quantity, offer_id=offer.id))
        else:
            next_quantity = (existing.quantity if existing else 0) + quantity
            if next_quantity > stock:
                raise ValidationException(f"Only {stock} of '{product.name}' in stock")
            if existing:
                if existing.offer_id:
                    raise ValidationException("This item is in your cart at a negotiated price — remove it to change the quantity")
                existing.quantity = next_quantity
            else:
                await self.repo.add(CartItem(cart_id=cart.id, product_id=product.id, variant_id=data.variant_id,
                                             quantity=quantity))
        await self.db.flush()
        return await self.get_cart(user_id)

    async def set_line(self, user_id: int, product_id: int, variant_id: Optional[int], quantity: int) -> None:
        """Put exactly `quantity` of a line in the cart (used by Buy Again)."""
        buyer = await self._buyer(user_id)
        cart = await self.repo.get_or_create(buyer.id)
        existing = await self.repo.get_line(cart.id, product_id, variant_id)
        if existing:
            existing.quantity, existing.offer_id = quantity, None
        else:
            await self.repo.add(CartItem(cart_id=cart.id, product_id=product_id, variant_id=variant_id, quantity=quantity))
        await self.db.flush()

    async def update_item(self, user_id: int, item_id: int, data: CartItemUpdate) -> dict:
        buyer = await self._buyer(user_id)
        cart = await self.repo.get_or_create(buyer.id)
        item = await self.repo.get_item_by_id(cart.id, item_id)
        if not item:
            raise NotFoundException("CartItem", str(item_id))
        if item.offer_id:
            raise ValidationException("The quantity of a negotiated item is fixed by the offer")
        stock = (item.variant or item.product).stock
        if data.quantity > stock:
            raise ValidationException(f"Only {stock} of '{item.product.name}' in stock")
        item.quantity = data.quantity
        await self.db.flush()
        return await self.get_cart(user_id)

    async def remove_item(self, user_id: int, item_id: int) -> dict:
        buyer = await self._buyer(user_id)
        cart = await self.repo.get_or_create(buyer.id)
        await self.repo.remove_item(cart.id, item_id)
        return await self.get_cart(user_id)

    async def clear_cart(self, user_id: int) -> dict:
        buyer = await self._buyer(user_id)
        cart = await self.repo.get_or_create(buyer.id)
        await self.repo.clear(cart.id)
        return await self.get_cart(user_id)

    async def checkout(self, user_id: int, data: CheckoutRequest) -> list[dict]:
        """One order per seller, all in one transaction."""
        buyer = await self._buyer(user_id)
        cart = await self.repo.get_or_create(buyer.id)
        items = await self.repo.list_items(cart.id)
        if not items:
            raise ValidationException("Cart is empty")
        address = (await self.db.execute(
            select(Address).where(Address.id == data.address_id, Address.buyer_id == buyer.id)
        )).scalar_one_or_none()
        if not address:
            raise NotFoundException("Address", str(data.address_id))

        by_seller: dict[int, list[CartItem]] = defaultdict(list)
        for item in items:
            by_seller[item.product.seller_id].append(item)

        order_service = OrderService(self.db)
        created = []
        for seller_items in by_seller.values():
            overrides, offer_ids, offers = {}, {}, []
            for i in seller_items:
                if i.offer_id and i.offer and _status(i.offer.status) == "accepted" and i.offer.fulfilled_order_id is None:
                    overrides[(i.product_id, i.variant_id)] = i.offer.offered_price
                    offer_ids[(i.product_id, i.variant_id)] = i.offer_id
                    offers.append(i.offer)
            order = await order_service.create_order(
                user_id,
                OrderCreate(
                    items=[OrderItemCreate(product_id=i.product_id, variant_id=i.variant_id, quantity=i.quantity)
                           for i in seller_items],
                    address_id=data.address_id,
                    delivery_option=data.delivery_option,
                    payment_method=data.payment_method,
                    notes=data.notes,
                ),
                price_overrides=overrides, offer_ids=offer_ids,
            )
            for offer in offers:
                offer.fulfilled_order_id = order["id"]
            created.append(order)

        await self.repo.clear(cart.id)
        return created
