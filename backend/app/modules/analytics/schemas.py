from datetime import datetime
from typing import Optional, List


from pydantic import BaseModel


class AnalyticsResponse(BaseModel):
    seller_id: int
    total_orders: int = 0
    total_revenue: float = 0.0
    average_order_value: float = 0.0
    conversion_rate: float = 0.0
    response_time_avg: Optional[float] = None
    period: Optional[datetime] = None
    computed_at: Optional[datetime] = None


class TrustScoreResponse(BaseModel):
    seller_id: int
    overall_score: float
    review_score: float
    compliance_score: float
    communication_score: float
    successful_orders: int
    cancellation_rate: float
    last_updated: Optional[datetime] = None