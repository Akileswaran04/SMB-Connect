from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.modules.buyer_profile.service import BuyerProfileService


async def get_buyer_profile_service(
    db: AsyncSession = Depends(get_db),
) -> BuyerProfileService:
    return BuyerProfileService(db)