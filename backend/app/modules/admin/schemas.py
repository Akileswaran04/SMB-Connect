from datetime import datetime
from typing import Optional, Literal


from pydantic import BaseModel, Field


class VerificationResponse(BaseModel):
    id: int
    seller_id: int
    business_name: Optional[str] = None
    verification_type: str
    document_reference: Optional[str]
    status: str
    submitted_at: Optional[datetime] = None


class VerificationDecision(BaseModel):
    decision: Literal["approved", "rejected", "info_requested"]
    reason: Optional[str] = Field(None, max_length=1000)


class SellerDecision(BaseModel):
    decision: Literal["approve", "reject", "request_info"]
    note: Optional[str] = Field(None, max_length=1000)


class UserUpdate(BaseModel):
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    role: Optional[Literal["buyer", "seller", "logistics", "admin"]] = None


class ProductModeration(BaseModel):
    status: Literal["published", "archived", "deleted"]
    note: Optional[str] = Field(None, max_length=500)


class ReportResolution(BaseModel):
    status: Literal["resolved", "dismissed"]
    note: Optional[str] = Field(None, max_length=500)
    remove_product: bool = False


class CategoryIn(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    icon: Optional[str] = Field(None, max_length=50)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    resource_type: str
    resource_id: Optional[int]
    changes: Optional[str]
    created_at: Optional[datetime] = None
