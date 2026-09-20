from datetime import datetime
from typing import Optional, List


from pydantic import BaseModel


class SellerPublicResponse(BaseModel):
    id: int
    business_name: str
    business_type: Optional[str]
    description: Optional[str]
    city: Optional[str]
    country: Optional[str]
    verification_status: Optional[str]
    trust_score: Optional[float] = None
    product_count: int = 0
    created_at: Optional[datetime] = None


class ProductSearchItem(BaseModel):
    id: int
    name: str
    description: Optional[str]
    category: Optional[str]
    price: float
    image_url: Optional[str]
    stock: int
    seller_id: int
    seller_name: Optional[str]
    seller_city: Optional[str]
    seller_verification_status: Optional[str]
    trust_score: Optional[float] = None


class DiscoveryResponse(BaseModel):
    items: List[ProductSearchItem]
    total: int
    next_cursor: Optional[str] = None
    limit: int