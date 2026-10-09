"""Cart module dependencies."""
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.modules.cart.service import CartService


async def get_cart_service(
    db: AsyncSession = Depends(get_db),
) -> CartService:
    """Provide CartService with database session."""
    return CartService(db)
