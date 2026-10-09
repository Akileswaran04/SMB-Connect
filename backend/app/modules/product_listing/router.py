from typing import List


from fastapi import APIRouter, Depends, Query, status

from app.core.dependencies import get_current_user_id, get_current_user, get_optional_user
from app.modules.product_listing.dependencies import get_product_service
from app.modules.product_listing.schemas import (
    ProductCreate, ProductUpdate, ProductResponse, ProductListResponse,
    StockUpdate, LikeResponse, ReviewCreate, ReviewResponse, ReviewReply,
    VariantCreate, VariantUpdate, ProductReportCreate,
)
from app.modules.product_listing.service import ProductService

router = APIRouter()


@router.get("", response_model=ProductListResponse)
async def list_products(
    limit: int = Query(100, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user_id),
    service: ProductService = Depends(get_product_service),
):
    """The signed-in seller's own products, including archived ones."""
    return await service.get_products_by_seller(int(user_id), limit=limit, offset=offset)


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    user_id: str = Depends(get_current_user_id),
    service: ProductService = Depends(get_product_service),
):
    return await service.create_product(int(user_id), data)


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    viewer=Depends(get_optional_user),
    service: ProductService = Depends(get_product_service),
):
    return await service.get_product(product_id, viewer)


@router.get("/{product_id}/details")
async def get_product_details(
    product_id: int,
    viewer=Depends(get_optional_user),
    service: ProductService = Depends(get_product_service),
):
    """Product page: price, options, delivery, returns, seller trust, reviews."""
    return await service.get_details(product_id, viewer)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    data: ProductUpdate,
    user_id: str = Depends(get_current_user_id),
    service: ProductService = Depends(get_product_service),
):
    return await service.update_product(int(user_id), product_id, data)


@router.delete("/{product_id}")
async def delete_product(
    product_id: int,
    user_id: str = Depends(get_current_user_id),
    service: ProductService = Depends(get_product_service),
):
    """Deletes an unused product; archives one that has order history."""
    return await service.delete_product(int(user_id), product_id)


@router.patch("/{product_id}/stock", response_model=ProductResponse)
async def adjust_stock(
    product_id: int,
    data: StockUpdate,
    user_id: str = Depends(get_current_user_id),
    service: ProductService = Depends(get_product_service),
):
    return await service.adjust_stock(int(user_id), product_id, data.delta, data.variant_id, data.note)


@router.post("/{product_id}/variants", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def add_variant(
    product_id: int,
    data: VariantCreate,
    user_id: str = Depends(get_current_user_id),
    service: ProductService = Depends(get_product_service),
):
    return await service.add_variant(int(user_id), product_id, data)


@router.put("/{product_id}/variants/{variant_id}", response_model=ProductResponse)
async def update_variant(
    product_id: int,
    variant_id: int,
    data: VariantUpdate,
    user_id: str = Depends(get_current_user_id),
    service: ProductService = Depends(get_product_service),
):
    return await service.update_variant(int(user_id), product_id, variant_id, data)


@router.delete("/{product_id}/variants/{variant_id}", response_model=ProductResponse)
async def delete_variant(
    product_id: int,
    variant_id: int,
    user_id: str = Depends(get_current_user_id),
    service: ProductService = Depends(get_product_service),
):
    return await service.delete_variant(int(user_id), product_id, variant_id)


@router.post("/{product_id}/like", response_model=LikeResponse)
async def toggle_like(
    product_id: int,
    service: ProductService = Depends(get_product_service),
):
    return await service.toggle_like(product_id)


@router.post("/{product_id}/report", status_code=status.HTTP_201_CREATED)
async def report_product(
    product_id: int,
    data: ProductReportCreate,
    user=Depends(get_current_user),
    service: ProductService = Depends(get_product_service),
):
    """Flag an inappropriate product for admin moderation."""
    return await service.report(user.id, product_id, data.reason)


@router.get("/{product_id}/reviews", response_model=List[ReviewResponse])
async def list_reviews(
    product_id: int,
    service: ProductService = Depends(get_product_service),
):
    return await service.get_reviews(product_id)


@router.post("/{product_id}/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def add_review(
    product_id: int,
    data: ReviewCreate,
    user_id: str = Depends(get_current_user_id),
    service: ProductService = Depends(get_product_service),
):
    return await service.add_review(int(user_id), product_id, data)


@router.put("/{product_id}/reviews/{review_id}/reply", response_model=ReviewResponse)
async def reply_to_review(
    product_id: int,
    review_id: int,
    data: ReviewReply,
    user_id: str = Depends(get_current_user_id),
    service: ProductService = Depends(get_product_service),
):
    return await service.reply_to_review(int(user_id), review_id, data)
