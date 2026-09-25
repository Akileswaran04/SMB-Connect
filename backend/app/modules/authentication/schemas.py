from typing import Optional, Literal


from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: Literal["seller", "buyer"] = Field(..., description="Role picker shown at registration")
    full_name: Optional[str] = None
    phone: Optional[str] = None

    business_name: Optional[str] = None
    business_type: Optional[str] = None
    license_number: Optional[str] = None

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None


class LoginRequest(BaseModel):
    identifier: str = Field(..., description="Email or phone number")
    password: str


class DemoLoginRequest(BaseModel):
    demo: Literal["seller1", "seller2", "seller3", "buyer1", "buyer2", "buyer3", "admin"] = Field(
        ..., description="Demo account key (seller1-3, buyer1-3, admin)"
    )


class LanguageUpdate(BaseModel):
    preferred_language: str = Field(..., min_length=2, max_length=10)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    seller_id: Optional[str] = None
    buyer_id: Optional[str] = None
    email: Optional[str]
    full_name: Optional[str]


class SellerProfileResponse(BaseModel):
    id: str
    store_name: Optional[str]
    category: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    description: Optional[str]
    avatar_image: Optional[str]
    is_verified: bool
    created_at: Optional[str]