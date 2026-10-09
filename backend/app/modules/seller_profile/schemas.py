
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


# ponytail: images and documents are inline data URLs returned with the profile,
# so keep them small; move to object storage + URLs if sellers need bigger files.
MAX_IMAGE_CHARS = 1_400_000      # ~1 MB file once base64-encoded
MAX_DOCUMENT_CHARS = 1_400_000
MAX_DOCUMENTS = 3
_IMAGE_PREFIXES = ("data:image/png;", "data:image/jpeg;", "data:image/webp;", "data:image/gif;")
_DOCUMENT_PREFIXES = _IMAGE_PREFIXES + ("data:application/pdf;",)


def _check_image(v: Optional[str]) -> Optional[str]:
    if not v:
        return None
    if v.startswith("https://") and len(v) <= 2000:
        return v
    if v.startswith(_IMAGE_PREFIXES) and len(v) <= MAX_IMAGE_CHARS:
        return v
    raise ValueError("Image must be a PNG/JPEG/WebP/GIF under 1 MB or an https URL")


class SellerProfileUpdate(BaseModel):
    owner_name: Optional[str] = Field(None, max_length=255)
    bank_account_holder: Optional[str] = Field(None, max_length=255)
    # Write-only: only the last 4 digits are stored.
    bank_account_number: Optional[str] = Field(None, pattern=r"^\d{9,18}$")
    bank_ifsc: Optional[str] = Field(None, pattern=r"^[A-Za-z]{4}0[A-Za-z0-9]{6}$")
    upi_id: Optional[str] = Field(None, pattern=r"^[\w.\-]{2,64}@[A-Za-z]{2,32}$")
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
    avatar_image: Optional[str] = None
    cover_image: Optional[str] = None
    documents: Optional[List[dict]] = None

    @field_validator("avatar_image", "cover_image")
    @classmethod
    def validate_image(cls, v):
        return _check_image(v)

    @field_validator("documents")
    @classmethod
    def validate_documents(cls, docs):
        if docs is None:
            return None
        if len(docs) > MAX_DOCUMENTS:
            raise ValueError(f"At most {MAX_DOCUMENTS} documents")
        cleaned = []
        for d in docs:
            data_url = d.get("dataUrl")
            if not isinstance(data_url, str) or not data_url.startswith(_DOCUMENT_PREFIXES)                     or len(data_url) > MAX_DOCUMENT_CHARS:
                raise ValueError("Each document must be a PDF or image under 1 MB")
            cleaned.append({
                "id": str(d.get("id") or "")[:64],
                "name": str(d.get("name") or "document")[:255],
                "dataUrl": data_url,
                "uploadedAt": str(d.get("uploadedAt") or "")[:40] or None,
                # Sellers can't mark their own documents verified.
                "status": "pending",
            })
        return cleaned


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
    owner_name: Optional[str] = None
    bank_account_holder: Optional[str] = None
    bank_account_last4: Optional[str] = None
    bank_ifsc: Optional[str] = None
    upi_id: Optional[str] = None
    avatar_image: Optional[str] = None
    cover_image: Optional[str] = None
    documents: Optional[List[dict]] = None
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
