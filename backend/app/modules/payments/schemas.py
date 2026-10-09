from datetime import datetime
from typing import Optional, Literal


from pydantic import BaseModel, Field


class PaymentCreate(BaseModel):
    order_id: int
    provider: str = "mock"
    amount: Optional[float] = Field(None, gt=0)


class PaymentResponse(BaseModel):
    id: int
    order_id: int
    provider: str
    status: str
    amount: float
    currency: str
    reference: Optional[str]
    failure_reason: Optional[str]
    created_at: Optional[datetime] = None


class TransactionCreate(BaseModel):
    order_id: int
    amount: float = Field(..., gt=0)
    payment_method: Optional[str] = "mock"


class TransactionResponse(BaseModel):
    id: int
    order_id: int
    amount: float
    currency: str
    status: str
    payment_method: Optional[str]
    transaction_id: Optional[str]
    failure_reason: Optional[str]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None