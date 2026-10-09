from typing import Optional


from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.seller_profile.models import Product


class ProductRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, seller_id: int, data: dict) -> Product:
        product = Product(seller_id=seller_id, **data)
        self.db.add(product)
        await self.db.flush()
        await self.db.refresh(product)
        return product

    async def get_by_id(self, product_id: int) -> Optional[Product]:
        result = await self.db.execute(
            select(Product)
            .where(Product.id == product_id)
        )
        return result.scalar_one_or_none()

    async def get_by_seller(
        self, seller_id: int, limit: int = 100, offset: int = 0, include_archived: bool = True
    ) -> tuple[list[Product], bool]:
        query = select(Product).where(Product.seller_id == seller_id)
        if not include_archived:
            query = query.where(Product.status == "published")
        result = await self.db.execute(
            query
            .order_by(Product.created_at.desc())
            .limit(limit + 1)
            .offset(offset)
        )
        rows = list(result.scalars().all())
        has_more = len(rows) > limit
        return rows[:limit], has_more

    async def update(self, product_id: int, data: dict) -> Optional[Product]:
        await self.db.execute(
            update(Product)
            .where(Product.id == product_id)
            .values(**data)
        )
        await self.db.flush()
        return await self.get_by_id(product_id)

    async def delete(self, product_id: int) -> bool:
        product = await self.get_by_id(product_id)
        if not product:
            return False
        await self.db.delete(product)
        await self.db.flush()
        return True


