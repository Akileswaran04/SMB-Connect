from datetime import datetime
from typing import Optional, List


from pydantic import BaseModel, Field


class SentimentRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)


class SentimentResponse(BaseModel):
    label: str
    score: float
    intent: str
    lead_score: int
    strategy: str
    draft: str


class AIInteractionCreate(BaseModel):
    conversation_id: Optional[int] = None
    message_text: str = Field(..., min_length=1)
    emotion: Optional[str] = None
    strategy: Optional[str] = None
    lead_score: Optional[int] = None
    ai_response: Optional[str] = None
    was_sent: bool = False
    was_edited: bool = False


class AIInteractionResponse(BaseModel):
    id: int
    conversation_id: Optional[int]
    seller_id: int
    message_text: str
    emotion: Optional[str]
    strategy: Optional[str]
    lead_score: Optional[int]
    ai_response: Optional[str]
    was_sent: bool
    was_edited: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AIStatsResponse(BaseModel):
    total_interactions: int
    total_sent: int
    total_edited: int
    avg_lead_score: Optional[float]
    emotion_distribution: dict
    strategy_distribution: dict
