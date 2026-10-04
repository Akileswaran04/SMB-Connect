from datetime import datetime
from typing import Optional, Literal, List


from pydantic import BaseModel, Field


class DraftCreate(BaseModel):
    conversation_id: str = Field(..., description="Mongo conversation id")
    reply_to_message_id: Optional[str] = None


class DraftUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)


class DraftStatusUpdate(BaseModel):
    status: Literal["approved", "rejected"]


class DraftResponse(BaseModel):
    id: str
    conversation_id: str
    seller_id: int
    reply_to_message_id: Optional[str] = None
    original_message: Optional[str] = None
    intent: Optional[str] = None
    sentiment_label: Optional[str] = None
    lead_score: Optional[int] = None
    draft_content: str
    status: str = "pending"
    created_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None