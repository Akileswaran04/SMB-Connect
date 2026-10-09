from datetime import datetime
from typing import Optional


from pydantic import BaseModel, Field


class BuyerProfileUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = None
    default_address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    preferred_payment_method: Optional[str] = Field(None, max_length=50)
    is_business_buyer: Optional[bool] = None
    company_name: Optional[str] = Field(None, max_length=255)
    tax_id: Optional[str] = Field(None, max_length=100)


class BuyerProfileResponse(BaseModel):
    id: int
    user_id: int
    first_name: str
    last_name: str
    phone: Optional[str]
    default_address: Optional[str]
    city: Optional[str]
    country: Optional[str]
    postal_code: Optional[str]
    preferred_payment_method: Optional[str]
    is_business_buyer: bool
    company_name: Optional[str]
    tax_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AddressCreate(BaseModel):
    label: str = Field("Home", max_length=100)
    line1: str = Field(..., min_length=1, max_length=255)
    line2: Optional[str] = Field(None, max_length=255)
    city: str = Field(..., min_length=1, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: str = Field("India", max_length=100)
    is_default: bool = False


class AddressUpdate(BaseModel):
    label: Optional[str] = Field(None, max_length=100)
    line1: Optional[str] = Field(None, min_length=1, max_length=255)
    line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, min_length=1, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)
    is_default: Optional[bool] = None


class AddressResponse(BaseModel):
    id: int
    buyer_id: int
    label: str
    line1: str
    line2: Optional[str]
    city: str
    state: Optional[str]
    postal_code: Optional[str]
    country: str
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True