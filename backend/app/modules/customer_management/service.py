

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.customer_management.repository import CustomerRepository
from app.modules.seller_profile.models import SellerProfile
from app.modules.customer_management.schemas import CustomerCreate, CustomerUpdate
from app.core.exceptions import NotFoundException


class CustomerService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.customer_repo = CustomerRepository(db)

    async def _get_seller_id_from_user(self, user_id: int) -> int:
        result = await self.db.execute(
            select(SellerProfile).where(SellerProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise NotFoundException("SellerProfile", str(user_id))
        return profile.id

    async def create_customer(self, user_id: int, data: CustomerCreate) -> dict:
        seller_id = await self._get_seller_id_from_user(user_id)
        customer = await self.customer_repo.create(
            seller_id=seller_id,
            data=data.model_dump(exclude_unset=True),
        )
        return customer

    async def get_customer(self, customer_id: int) -> dict:
        customer = await self.customer_repo.get_by_id(customer_id)
        if not customer:
            raise NotFoundException("Customer", str(customer_id))
        return customer

    async def get_customers_by_seller(self, user_id: int) -> list:
        seller_id = await self._get_seller_id_from_user(user_id)
        return await self.customer_repo.get_by_seller(seller_id)

    async def update_customer(self, customer_id: int, data: CustomerUpdate) -> dict:
        customer = await self.customer_repo.get_by_id(customer_id)
        if not customer:
            raise NotFoundException("Customer", str(customer_id))

        update_data = data.model_dump(exclude_unset=True)
        updated = await self.customer_repo.update(customer_id, update_data)
        return updated

    async def delete_customer(self, customer_id: int) -> bool:
        customer = await self.customer_repo.get_by_id(customer_id)
        if not customer:
            raise NotFoundException("Customer", str(customer_id))
        return await self.customer_repo.delete(customer_id)
