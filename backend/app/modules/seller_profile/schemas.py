
from datetime import datetime
from typing import Optional, List


from pydantic import BaseModel, EmailStr, Field, field_validator

from app.shared.enums import SellerProfileStatus, BusinessType
from app.shared.constants import (
    MAX_BUSINESS_NAME_LENGTH, MAX_DESCRIPTION_LENGTH,
    MAX_PHONE_LENGTH, MAX_ADDRESS_LENGTH, MAX_LICENSE_LENGTH
)


class SellerProfileCreate(BaseModel):
    business_name: str = Field(..., min_length=1, max_length=MAX_BUSINESS_NAME_LENGTH)
    business_type: str = Field(..., min_length=1)
    description: Optional[str] = Field(None, max_length=MAX_DESCRIPTION_LENGTH)
    phone: Optional[str] = Field(None, max_length=MAX_PHONE_LENGTH)
    email: Optional[EmailStr] = None
    website: Optional[str] = Field(None, max_length=2000)
    address_line_1: Optional[str] = Field(None, max_length=MAX_ADDRESS_LENGTH)
    address_line_2: Optional[str] = Field(None, max_length=MAX_ADDRESS_LENGTH)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field("India", max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    license_number: Optional[str] = Field(None, max_length=MAX_LICENSE_LENGTH)


class SellerProfileUpdate(BaseModel):
    business_name: Optional[str] = Field(None, min_length=1, max_length=MAX_BUSINESS_NAME_LENGTH)
    business_type: Optional[str] = None
    description: Optional[str] = Field(None, max_length=MAX_DESCRIPTION_LENGTH)
    phone: Optional[str] = Field(None, max_length=MAX_PHONE_LENGTH)
    email: Optional[EmailStr] = None
    website: Optional[str] = Field(None, max_length=2000)
    address_line_1: Optional[str] = Field(None, max_length=MAX_ADDRESS_LENGTH)
    address_line_2: Optional[str] = Field(None, max_length=MAX_ADDRESS_LENGTH)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    license_number: Optional[str] = Field(None, max_length=MAX_LICENSE_LENGTH)


class SellerProfileResponse(BaseModel):
    id: int
    user_id: int
    business_name: str
    business_type: str
    description: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    website: Optional[str]
    address_line_1: Optional[str]
    address_line_2: Optional[str]
    city: Optional[str]
    state: Optional[str]
    country: Optional[str]
    postal_code: Optional[str]
    license_number: Optional[str]
    verification_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SellerVerificationResponse(BaseModel):
    id: int
    seller_id: int
    verification_type: str
    status: str
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    rejection_reason: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StatusUpdateRequest(BaseModel):
    status: SellerProfileStatus
    rejection_reason: Optional[str] = None

    @field_validator("rejection_reason")
    @classmethod
    def validate_rejection_reason(cls, v, info):
        if info.data.get("status") == SellerProfileStatus.REJECTED and not v:
            raise ValueError("Rejection reason is required when rejecting")
        return v


class ProfileSubmitResponse(BaseModel):
    profile: SellerProfileResponse
    message: str = "Profile submitted for verification"
