
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user_id
from app.modules.seller_profile.service import SellerProfileService


async def get_seller_profile_service(
    db: AsyncSession = Depends(get_db),
) -> SellerProfileService:
    return SellerProfileService(db)
