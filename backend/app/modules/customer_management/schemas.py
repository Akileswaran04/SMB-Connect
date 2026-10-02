from datetime import datetime
from typing import Optional, List


from pydantic import BaseModel, Field


class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[str] = None
    phone: Optional[str] = None
    total_orders: int = Field(0, ge=0)
    last_order_date: Optional[datetime] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[str] = None
    phone: Optional[str] = None
    total_orders: Optional[int] = Field(None, ge=0)
    last_order_date: Optional[datetime] = None


class CustomerResponse(BaseModel):
    id: int
    seller_id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    total_orders: int
    last_order_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
