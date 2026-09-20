from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.buyer_profile.repository import BuyerProfileRepository
from app.modules.buyer_profile.schemas import BuyerProfileUpdate, AddressCreate, AddressUpdate
from app.core.exceptions import NotFoundException, ValidationException


class BuyerProfileService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = BuyerProfileRepository(db)

    async def get_own_profile(self, user_id: int) -> dict:
        profile = await self.repo.get_by_user_id(user_id)
        if not profile:
            raise NotFoundException("BuyerProfile", str(user_id))
        return profile

    async def get_profile(self, buyer_id: int) -> dict:
        profile = await self.repo.get_by_id(buyer_id)
        if not profile:
            raise NotFoundException("BuyerProfile", str(buyer_id))
        return profile

    async def update_own_profile(self, user_id: int, data: BuyerProfileUpdate) -> dict:
        profile = await self.repo.get_by_user_id(user_id)
        if not profile:
            raise NotFoundException("BuyerProfile", str(user_id))

        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            raise ValidationException("No fields to update")

        updated = await self.repo.update(profile.id, update_data)
        return updated


    async def _get_buyer_id(self, user_id: int) -> int:
        profile = await self.repo.get_by_user_id(user_id)
        if not profile:
            raise NotFoundException("BuyerProfile", str(user_id))
        return profile.id

    async def list_addresses(self, user_id: int) -> list:
        buyer_id = await self._get_buyer_id(user_id)
        return await self.repo.list_addresses(buyer_id)

    async def create_address(self, user_id: int, data: AddressCreate):
        buyer_id = await self._get_buyer_id(user_id)
        return await self.repo.create_address(buyer_id, data.model_dump())

    async def update_address(self, user_id: int, address_id: int, data: AddressUpdate):
        buyer_id = await self._get_buyer_id(user_id)
        existing = await self.repo.get_address(buyer_id, address_id)
        if not existing:
            raise NotFoundException("Address", str(address_id))
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            raise ValidationException("No fields to update")
        return await self.repo.update_address(buyer_id, address_id, update_data)

    async def delete_address(self, user_id: int, address_id: int) -> None:
        buyer_id = await self._get_buyer_id(user_id)
        existing = await self.repo.get_address(buyer_id, address_id)
        if not existing:
            raise NotFoundException("Address", str(address_id))
        await self.repo.delete_address(buyer_id, address_id)