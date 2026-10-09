from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.modules.customer_management.service import CustomerService


async def get_customer_service(
    db: AsyncSession = Depends(get_db),
) -> CustomerService:
    return CustomerService(db)
