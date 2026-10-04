"""Recommendation module dependencies."""
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.modules.recommendation.service import RecommendationService


async def get_recommendation_service(
    db: AsyncSession = Depends(get_db),
) -> RecommendationService:
    """Provide RecommendationService with database session."""
    return RecommendationService(db)
