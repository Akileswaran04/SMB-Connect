"""Recommendation Router — HTTP endpoints only."""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_optional_user, get_db
from app.infrastructure.redis.ratelimit import rate_limit
from app.modules.buyer_profile.personalisation import PersonalisationService
from app.modules.recommendation.dependencies import get_recommendation_service
from app.modules.recommendation.schemas import RecommendationResponse, CompareRequest, CompareResponse
from app.modules.recommendation.service import RecommendationService

router = APIRouter()


async def buyer_context(user, db) -> dict:
    """Personalisation signals for a signed-in buyer (empty otherwise)."""
    if user is None or user.role != "buyer":
        return {}
    try:
        return (await PersonalisationService(db).profile(user.id))["effective"]
    except Exception:
        return {}


@router.get("", response_model=RecommendationResponse)
async def recommend(
    category: Optional[str] = Query(None),
    budget: Optional[float] = Query(None, gt=0),
    q: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    size: Optional[str] = Query(None, max_length=30),
    color: Optional[str] = Query(None, max_length=40),
    priority: Optional[Literal["price", "quality", "comfort", "delivery"]] = Query(None),
    user=Depends(get_optional_user),
    db=Depends(get_db),
    service: RecommendationService = Depends(get_recommendation_service),
):
    """2-3 relevant, reasoned product recommendations — never a full list."""
    items = await service.recommend(category=category, budget=budget, q=q, location=location, priority=priority,
                                    size=size, color=color, context=await buyer_context(user, db))
    return {"items": items}


@router.post(
    "/compare",
    response_model=CompareResponse,
    dependencies=[Depends(rate_limit(20, 60, "ai:compare"))],
)
async def compare(
    data: CompareRequest,
    user=Depends(get_current_user),
    db=Depends(get_db),
    service: RecommendationService = Depends(get_recommendation_service),
):
    """Smart comparison of 2-3 buyer-selected products."""
    return await service.compare(data, await buyer_context(user, db))
