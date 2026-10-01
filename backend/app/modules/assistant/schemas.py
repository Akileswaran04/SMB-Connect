"""Pydantic schemas for the assistant module."""
from typing import Optional, List, Literal

from pydantic import BaseModel, Field

from app.modules.recommendation.schemas import RecommendedItem


class AssistantContext(BaseModel):
    """What's on the shopper's screen, so 'the second one' or 'this' resolves."""
    product_ids: List[int] = Field(default_factory=list, max_length=10)
    current_product_id: Optional[int] = None
    last_extraction: Optional[dict] = None


class UnderstandRequest(BaseModel):
    """A buyer's free-text (or transcribed voice) requirement."""
    text: str = Field(..., min_length=1, max_length=500)
    priority: Optional[Literal["price", "quality", "comfort", "delivery"]] = None


class RequirementExtraction(BaseModel):
    category: Optional[str] = None
    matched_category: Optional[str] = None
    keywords: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    applied_size: Optional[str] = None
    budget: Optional[float] = None
    use_case: Optional[str] = None
    priority: Optional[str] = None
    language: Optional[str] = None
    source: Optional[str] = None


class FollowUpOption(BaseModel):
    label: str
    priority: str


class FollowUp(BaseModel):
    text: str
    options: List[FollowUpOption]


class UnderstandResponse(BaseModel):
    """Either a confident extraction + recommendations, or a single
    clarifying question — never a long form (PRD §8)."""
    understood: bool
    extraction: Optional[RequirementExtraction] = None
    question: Optional[str] = None
    options: List[str] = Field(default_factory=list)
    follow_up: Optional[FollowUp] = None
    personal_note: Optional[str] = None
    recommendations: List[RecommendedItem] = Field(default_factory=list)


class ChatRequest(BaseModel):
    """One turn with the action assistant (text or transcribed voice)."""
    message: str = Field(..., min_length=1, max_length=500)
    context: Optional[dict] = None
    voice: bool = False
    language: Optional[str] = Field(None, max_length=30)


class VoiceRequest(BaseModel):
    """A transcribed voice query (browser does STT) plus its spoken language."""
    text: str = Field(..., min_length=1, max_length=500)
    source_language: str = Field("en", max_length=30, description="e.g. 'en', 'ta', 'Tamil', 'Tanglish'")
    context: Optional[dict] = None
