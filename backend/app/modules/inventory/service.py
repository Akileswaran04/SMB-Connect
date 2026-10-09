"""Inventory Service — stock reservation, release, fulfilment and adjustments
(PRD §33, §60). Every change locks the affected rows and writes an
InventoryTransaction, so stock can't be oversold and every unit is traceable.

Model: `stock` is available to sell; `reserved_stock` is held by placed
orders until the parcel leaves (on hand = stock + reserved). When a product
has variants, the variant rows are authoritative and the product's stock and
reserved figures are kept as their totals.
"""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, ValidationException
from app.modules.inventory.models import ProductVariant, InventoryTransaction
from app.modules.seller_profile.models import Product


class InventoryService:
    def __init__(self, db: AsyncSession, actor_user_id: Optional[int] = None):
        self.db = db
        self.actor_user_id = actor_user_id

    async def lock_product(self, product_id: int) -> Product:
        product = (await self.db.execute(
            select(Product).where(Product.id == product_id).with_for_update()
        )).scalar_one_or_none()
        if not product:
            raise NotFoundException("Product", str(product_id))
        return product

    async def lock_variant(self, product_id: int, variant_id: int) -> ProductVariant:
        variant = (await self.db.execute(
            select(ProductVariant)
            .where(ProductVariant.id == variant_id, ProductVariant.product_id == product_id)
            .with_for_update()
        )).scalar_one_or_none()
        if not variant:
            raise NotFoundException("ProductVariant", str(variant_id))
        return variant

    async def has_variants(self, product_id: int) -> bool:
        return (await self.db.execute(
            select(ProductVariant.id)
            .where(ProductVariant.product_id == product_id, ProductVariant.is_active.is_(True))
            .limit(1)
        )).scalar_one_or_none() is not None

    async def sync_product_totals(self, product: Product) -> None:
        """Recompute a variant product's stock figures from its variants."""
        variants = (await self.db.execute(
            select(ProductVariant).where(ProductVariant.product_id == product.id, ProductVariant.is_active.is_(True))
        )).scalars().all()
        if variants:
            product.stock = sum(v.stock for v in variants)
            product.reserved_stock = sum(v.reserved_stock for v in variants)
            product.incoming_stock = sum(v.incoming_stock for v in variants)

    def _log(self, product_id, variant_id, reason, stock_change=0, reserved_change=0, order_id=None, note=None):
        self.db.add(InventoryTransaction(
            product_id=product_id, variant_id=variant_id, order_id=order_id,
            stock_change=stock_change, reserved_change=reserved_change,
            reason=reason, note=note, actor_user_id=self.actor_user_id,
        ))

    async def _apply(self, product_id: int, variant_id: Optional[int], stock_delta: int, reserved_delta: int,
                     reason: str, order_id: Optional[int] = None, note: Optional[str] = None) -> None:
        product = await self.lock_product(product_id)
        target = await self.lock_variant(product_id, variant_id) if variant_id else product
        if target.stock + stock_delta < 0:
            name = product.name + (f" ({target.label})" if variant_id else "")
            raise ValidationException(f"Only {target.stock} of '{name}' available")
        if target.reserved_stock + reserved_delta < 0:
            raise ValidationException("Reserved stock would go below zero")
        target.stock += stock_delta
        target.reserved_stock += reserved_delta
        if variant_id:
            # Product figures are the variants' totals: apply the same change
            # (both rows are locked) instead of re-reading every variant.
            product.stock = max(0, product.stock + stock_delta)
            product.reserved_stock = max(0, product.reserved_stock + reserved_delta)
        self._log(product_id, variant_id, reason, stock_delta, reserved_delta, order_id, note)

    # ── Order lifecycle ──

    async def reserve(self, order_id: int, items: list) -> None:
        """Order placed: available -> reserved. Items are locked in id order
        so concurrent multi-item orders can't deadlock."""
        for item in sorted(items, key=lambda i: (i.product_id, i.variant_id or 0)):
            await self._apply(item.product_id, item.variant_id, -item.quantity, item.quantity, "order_reserved", order_id)

    async def release(self, order_id: int, items: list) -> None:
        """Cancelled before the parcel left: reserved -> available."""
        for item in sorted(items, key=lambda i: (i.product_id, i.variant_id or 0)):
            await self._apply(item.product_id, item.variant_id, item.quantity, -item.quantity, "order_cancelled", order_id)

    async def fulfil(self, order_id: int, items: list) -> None:
        """Parcel picked up: reserved units leave the warehouse."""
        for item in sorted(items, key=lambda i: (i.product_id, i.variant_id or 0)):
            await self._apply(item.product_id, item.variant_id, 0, -item.quantity, "order_shipped", order_id)

    async def restock_return(self, order_id: int, items: list) -> None:
        """Returned goods back on the shelf."""
        for item in sorted(items, key=lambda i: (i.product_id, i.variant_id or 0)):
            await self._apply(item.product_id, item.variant_id, item.quantity, 0, "order_returned", order_id)

    # ── Seller actions ──

    async def adjust(self, product_id: int, variant_id: Optional[int], delta: int, note: Optional[str] = None) -> None:
        if variant_id is None and await self.has_variants(product_id):
            raise ValidationException("This product has variants — adjust a specific variant")
        await self._apply(product_id, variant_id, delta, 0, "manual_adjustment", note=note)

    async def set_incoming(self, product_id: int, variant_id: Optional[int], quantity: int) -> None:
        if quantity < 0:
            raise ValidationException("Incoming stock cannot be negative")
        product = await self.lock_product(product_id)
        target = await self.lock_variant(product_id, variant_id) if variant_id else product
        target.incoming_stock = quantity
        if variant_id:
            await self.db.flush()
            await self.sync_product_totals(product)
        self._log(product_id, variant_id, "incoming_set", note=f"Incoming set to {quantity}")

    async def receive_incoming(self, product_id: int, variant_id: Optional[int]) -> int:
        product = await self.lock_product(product_id)
        target = await self.lock_variant(product_id, variant_id) if variant_id else product
        received = target.incoming_stock
        if received <= 0:
            raise ValidationException("No incoming stock to receive")
        target.stock += received
        target.incoming_stock = 0
        if variant_id:
            await self.db.flush()
            await self.sync_product_totals(product)
        self._log(product_id, variant_id, "incoming_received", stock_change=received)
        return received
