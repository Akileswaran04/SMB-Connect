from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.core.exceptions import ForbiddenException
from app.modules.analytics.dependencies import get_analytics_service
from app.modules.analytics.schemas import AnalyticsResponse, TrustScoreResponse
from app.modules.analytics.service import AnalyticsService
from app.modules.seller_profile.models import SellerProfile

router = APIRouter()


@router.get("/{seller_id}", response_model=AnalyticsResponse)
async def get_analytics(
    seller_id: int,
    force: bool = False,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    service: AnalyticsService = Depends(get_analytics_service),
):
    """Revenue and conversion figures are private to the seller (and admins)."""
    if user.role != "admin":
        owner_user_id = (await db.execute(
            select(SellerProfile.user_id).where(SellerProfile.id == seller_id)
        )).scalar_one_or_none()
        if owner_user_id != user.id:
            raise ForbiddenException("Not your analytics")
    return await service.get_seller_analytics(seller_id, force=force)


@router.get("/{seller_id}/trust-score", response_model=TrustScoreResponse)
async def get_trust_score(
    seller_id: int,
    service: AnalyticsService = Depends(get_analytics_service),
):
    """Public on purpose — buyers see it as a trust signal."""
    return await service.get_seller_trust_score(seller_id)
