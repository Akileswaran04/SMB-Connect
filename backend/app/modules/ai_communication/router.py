from typing import List


from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user_id
from app.modules.ai_communication.dependencies import get_ai_communication_service
from app.modules.ai_communication.schemas import (
    AIInteractionCreate, AIInteractionResponse, AIStatsResponse,
    SentimentRequest, SentimentResponse,
)
from app.modules.ai_communication.service import AICommunicationService
from app.modules.ai_communication.sentiment import analyze_message

router = APIRouter()


@router.post("/analyze", response_model=SentimentResponse)
async def analyze(data: SentimentRequest):
    return await analyze_message(data.content)


@router.get("/interactions", response_model=List[AIInteractionResponse])
async def list_interactions(
    limit: int = Query(50, ge=1, le=200),
    user_id: str = Depends(get_current_user_id),
    service: AICommunicationService = Depends(get_ai_communication_service),
):
    return await service.get_interactions(int(user_id), limit)


@router.post("/interactions", response_model=AIInteractionResponse)
async def log_interaction(
    data: AIInteractionCreate,
    user_id: str = Depends(get_current_user_id),
    service: AICommunicationService = Depends(get_ai_communication_service),
):
    return await service.log_interaction(int(user_id), data)


@router.get("/stats", response_model=AIStatsResponse)
async def get_stats(
    user_id: str = Depends(get_current_user_id),
    service: AICommunicationService = Depends(get_ai_communication_service),
):
    return await service.get_stats(int(user_id))
