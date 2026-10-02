from typing import Optional


from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.seller_profile.models import Customer


class CustomerRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, seller_id: int, data: dict) -> Customer:
        customer = Customer(seller_id=seller_id, **data)
        self.db.add(customer)
        await self.db.flush()
        await self.db.refresh(customer)
        return customer

    async def get_by_id(self, customer_id: int) -> Optional[Customer]:
        result = await self.db.execute(
            select(Customer).where(Customer.id == customer_id)
        )
        return result.scalar_one_or_none()

    async def get_by_seller(self, seller_id: int) -> list[Customer]:
        result = await self.db.execute(
            select(Customer)
            .where(Customer.seller_id == seller_id)
            .order_by(Customer.created_at.desc())
        )
        return list(result.scalars().all())

    async def update(self, customer_id: int, data: dict) -> Optional[Customer]:
        await self.db.execute(
            update(Customer)
            .where(Customer.id == customer_id)
            .values(**data)
        )
        await self.db.flush()
        return await self.get_by_id(customer_id)

    async def delete(self, customer_id: int) -> bool:
        customer = await self.get_by_id(customer_id)
        if not customer:
            return False
        await self.db.delete(customer)
        await self.db.flush()
        return True
