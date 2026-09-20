from typing import Optional


from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.buyer_profile.models import BuyerProfile, Address


class BuyerProfileRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_user_id(self, user_id: int) -> Optional[BuyerProfile]:
        result = await self.db.execute(
            select(BuyerProfile).where(BuyerProfile.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, buyer_id: int) -> Optional[BuyerProfile]:
        result = await self.db.execute(
            select(BuyerProfile).where(BuyerProfile.id == buyer_id)
        )
        return result.scalar_one_or_none()

    async def update(self, buyer_id: int, data: dict) -> Optional[BuyerProfile]:
        await self.db.execute(
            update(BuyerProfile)
            .where(BuyerProfile.id == buyer_id)
            .values(**data)
        )
        await self.db.flush()
        return await self.get_by_id(buyer_id)


    async def list_addresses(self, buyer_id: int) -> list[Address]:
        result = await self.db.execute(
            select(Address).where(Address.buyer_id == buyer_id).order_by(Address.id.asc())
        )
        return list(result.scalars().all())

    async def get_address(self, buyer_id: int, address_id: int) -> Optional[Address]:
        result = await self.db.execute(
            select(Address).where(Address.id == address_id, Address.buyer_id == buyer_id)
        )
        return result.scalar_one_or_none()

    async def _clear_default(self, buyer_id: int) -> None:
        await self.db.execute(
            update(Address).where(Address.buyer_id == buyer_id, Address.is_default.is_(True)).values(is_default=False)
        )

    async def create_address(self, buyer_id: int, data: dict) -> Address:
        if data.get("is_default"):
            await self._clear_default(buyer_id)
        elif not await self.list_addresses(buyer_id):
            data["is_default"] = True
        address = Address(buyer_id=buyer_id, **data)
        self.db.add(address)
        await self.db.flush()
        await self.db.refresh(address)
        return address

    async def update_address(self, buyer_id: int, address_id: int, data: dict) -> Optional[Address]:
        if data.get("is_default"):
            await self._clear_default(buyer_id)
        await self.db.execute(
            update(Address).where(Address.id == address_id, Address.buyer_id == buyer_id).values(**data)
        )
        await self.db.flush()
        return await self.get_address(buyer_id, address_id)

    async def delete_address(self, buyer_id: int, address_id: int) -> None:
        address = await self.get_address(buyer_id, address_id)
        if address:
            await self.db.delete(address)
            await self.db.flush()