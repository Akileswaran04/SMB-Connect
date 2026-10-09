from datetime import datetime
from typing import Optional, List, Literal, Dict


from pydantic import BaseModel, Field, field_validator


class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=255)
    comment: Optional[str] = Field(None, max_length=2000)


class ReviewResponse(BaseModel):
    id: int
    product_id: int
    customer_name: str
    rating: int
    title: Optional[str] = None
    comment: Optional[str]
    seller_reply: Optional[str]
    is_verified_purchase: bool = False
    created_at: datetime


class ReviewReply(BaseModel):
    seller_reply: str = Field(..., min_length=1, max_length=500)


class BulkTier(BaseModel):
    min_qty: int = Field(..., ge=2)
    unit_price: float = Field(..., gt=0)


class VariantCreate(BaseModel):
    size: Optional[str] = Field(None, max_length=30)
    color: Optional[str] = Field(None, max_length=40)
    sku: Optional[str] = Field(None, max_length=64)
    price: Optional[float] = Field(None, gt=0)
    stock: int = Field(0, ge=0)

    @field_validator("color")
    @classmethod
    def _needs_option(cls, v, info):
        if not v and not info.data.get("size"):
            raise ValueError("A variant needs a size or a colour")
        return v


class VariantUpdate(BaseModel):
    size: Optional[str] = Field(None, max_length=30)
    color: Optional[str] = Field(None, max_length=40)
    sku: Optional[str] = Field(None, max_length=64)
    price: Optional[float] = Field(None, gt=0)
    is_active: Optional[bool] = None


class VariantResponse(BaseModel):
    id: int
    product_id: int
    size: Optional[str]
    color: Optional[str]
    sku: Optional[str]
    price: Optional[float]
    effective_price: Optional[float] = None
    stock: int
    reserved_stock: int
    incoming_stock: int
    is_active: bool
    label: str


class _ProductFields(BaseModel):
    description: Optional[str] = Field(None, max_length=5000)
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    sku: Optional[str] = Field(None, max_length=64)
    sale_price: Optional[float] = Field(None, gt=0)
    promo_price: Optional[float] = Field(None, gt=0)
    promo_ends_at: Optional[datetime] = None
    bulk_pricing: Optional[List[BulkTier]] = None
    delivery_days: Optional[int] = Field(None, ge=1, le=60)
    express_available: Optional[bool] = None
    return_days: Optional[int] = Field(None, ge=0, le=90)
    return_policy: Optional[str] = Field(None, max_length=500)
    specifications: Optional[Dict[str, str]] = None
    low_stock_threshold: Optional[int] = Field(None, ge=0)


class ProductCreate(_ProductFields):
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field("general", min_length=1, max_length=100)
    price: float = Field(..., gt=0)
    stock: int = Field(0, ge=0)
    low_stock_threshold: int = Field(5, ge=0)
    delivery_days: int = Field(4, ge=1, le=60)
    express_available: bool = False
    return_days: int = Field(7, ge=0, le=90)
    variants: Optional[List[VariantCreate]] = None


class ProductUpdate(_ProductFields):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    price: Optional[float] = Field(None, gt=0)
    status: Optional[Literal["published", "archived"]] = None


class PriceInfo(BaseModel):
    listed: float
    unit: float
    discount_per_unit: float
    discount_pct: int
    reason: Optional[str]


class ProductResponse(BaseModel):
    id: int
    seller_id: int
    name: str
    description: Optional[str]
    category: str
    price: float
    image_url: Optional[str]
    images: Optional[List[str]] = None
    sku: Optional[str] = None
    status: str = "published"
    stock: int
    reserved_stock: int = 0
    incoming_stock: int = 0
    low_stock_threshold: int
    likes: int
    sale_price: Optional[float] = None
    promo_price: Optional[float] = None
    promo_ends_at: Optional[datetime] = None
    bulk_pricing: Optional[List[BulkTier]] = None
    delivery_days: int = 4
    express_available: bool = False
    return_days: int = 7
    return_policy: Optional[str] = None
    specifications: Optional[Dict[str, str]] = None
    price_info: Optional[PriceInfo] = None
    variants: List[VariantResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ProductListResponse(BaseModel):
    items: List[ProductResponse]
    has_more: bool
    limit: int
    offset: int


class StockUpdate(BaseModel):
    delta: int = Field(..., description="Amount to add (positive) or subtract (negative)")
    variant_id: Optional[int] = None
    note: Optional[str] = Field(None, max_length=255)


class LikeResponse(BaseModel):
    likes: int
    liked: bool


class ProductReportCreate(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)
