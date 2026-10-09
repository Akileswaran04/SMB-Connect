from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.modules.product_listing.service import ProductService


async def get_product_service(
    db: AsyncSession = Depends(get_db),
) -> ProductService:
    return ProductService(db)
