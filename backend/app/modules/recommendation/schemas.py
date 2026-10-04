"""Pydantic schemas for the recommendation module."""
from typing import Optional, List, Dict

from pydantic import BaseModel, Field


class RecommendedItem(BaseModel):
    """One ranked, reasoned recommendation."""
    product_id: int
    name: str
    price: float
    listed_price: Optional[float] = None
    discount_pct: int = 0
    image_url: Optional[str] = None
    category: str
    stock: int
    seller_id: int
    seller_name: Optional[str] = None
    trust_score: Optional[float] = None
    rating: Optional[float] = None
    rating_count: int = 0
    delivery_days: Optional[int] = None
    express_available: bool = False
    sizes: List[str] = Field(default_factory=list)
    has_variants: bool = False
    tag: str
    reasons: List[str]
    more_reasons: List[str] = Field(default_factory=list)


class RecommendationResponse(BaseModel):
    """2-3 highly relevant options — never a full list (PRD §9)."""
    items: List[RecommendedItem]


class CompareRequest(BaseModel):
    """Compare 2-3 products the buyer has selected."""
    product_ids: List[int] = Field(..., min_length=2, max_length=3)


class CompareRow(BaseModel):
    """One product's row: price, delivery, quality, reliability, availability."""
    product_id: int
    name: str
    price: float
    listed_price: Optional[float] = None
    delivery_days: int
    express_available: bool = False
    rating: Optional[float] = None
    rating_count: int = 0
    trust_score: Optional[float] = None
    seller_name: Optional[str] = None
    verified_seller: bool = False
    stock: int
    sizes: List[str] = Field(default_factory=list)
    return_days: Optional[int] = None
    specifications: Dict[str, str] = Field(default_factory=dict)


class CompareResponse(BaseModel):
    """AI-written summary (the 'work' of comparing) + server-computed facts
    (accuracy — numbers are never left to the LLM)."""
    summary: str
    differences: List[str] = Field(default_factory=list)
    best_for: Dict[str, int] = Field(default_factory=dict)
    table: List[CompareRow]
