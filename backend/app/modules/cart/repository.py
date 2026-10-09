"""Cart Repository — database operations only."""
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.cart.models import Cart, CartItem


class CartRepository:
    """Repository for carts/cart_items."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create(self, buyer_id: int) -> Cart:
        result = await self.db.execute(select(Cart).where(Cart.buyer_id == buyer_id))
        cart = result.scalar_one_or_none()
        if cart:
            return cart
        cart = Cart(buyer_id=buyer_id)
        self.db.add(cart)
        await self.db.flush()
        await self.db.refresh(cart)
        return cart

    async def list_items(self, cart_id: int) -> list[CartItem]:
        result = await self.db.execute(
            select(CartItem)
            .where(CartItem.cart_id == cart_id)
            .options(joinedload(CartItem.product), joinedload(CartItem.variant), joinedload(CartItem.offer))
            .order_by(CartItem.id.asc())
        )
        return list(result.unique().scalars().all())

    async def get_line(self, cart_id: int, product_id: int, variant_id: Optional[int]) -> Optional[CartItem]:
        query = select(CartItem).where(CartItem.cart_id == cart_id, CartItem.product_id == product_id)
        query = query.where(CartItem.variant_id == variant_id) if variant_id else query.where(CartItem.variant_id.is_(None))
        return (await self.db.execute(query)).scalar_one_or_none()

    async def get_item_by_id(self, cart_id: int, item_id: int) -> Optional[CartItem]:
        result = await self.db.execute(
            select(CartItem)
            .where(CartItem.id == item_id, CartItem.cart_id == cart_id)
            .options(joinedload(CartItem.product), joinedload(CartItem.variant), joinedload(CartItem.offer))
        )
        return result.unique().scalar_one_or_none()

    async def add(self, item: CartItem) -> None:
        self.db.add(item)
        await self.db.flush()

    async def remove_item(self, cart_id: int, item_id: int) -> None:
        await self.db.execute(delete(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart_id))
        await self.db.flush()

    async def clear(self, cart_id: int) -> None:
        await self.db.execute(delete(CartItem).where(CartItem.cart_id == cart_id))
        await self.db.flush()
