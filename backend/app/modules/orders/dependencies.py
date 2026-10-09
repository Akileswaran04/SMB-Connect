from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.modules.orders.service import OrderService


async def get_order_service(
    db: AsyncSession = Depends(get_db),
) -> OrderService:
    return OrderService(db)