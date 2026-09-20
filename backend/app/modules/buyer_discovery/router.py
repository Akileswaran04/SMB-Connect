from typing import Optional


from fastapi import APIRouter, Depends, Query

from app.modules.buyer_discovery.dependencies import get_discovery_service
from app.modules.buyer_discovery.schemas import (
    DiscoveryResponse, SellerPublicResponse,
)
from app.modules.buyer_discovery.service import DiscoveryService
from app.modules.product_listing.service import ProductService
from app.modules.product_listing.dependencies import get_product_service

router = APIRouter()


@router.get("/discover", response_model=DiscoveryResponse)
async def discover(
    category: Optional[str] = Query(None, max_length=100),
    location: Optional[str] = Query(None, max_length=100),
    budget: Optional[float] = Query(None, gt=0),
    q: Optional[str] = Query(None, max_length=255),
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = Query(None, description="Opaque offset cursor"),
    service: DiscoveryService = Depends(get_discovery_service),
):
    offset = int(cursor) if cursor and cursor.isdigit() else 0
    return await service.search_products(
        category=category,
        location=location,
        budget=budget,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.get("/sellers/{seller_id}", response_model=SellerPublicResponse)
async def get_seller(
    seller_id: int,
    service: DiscoveryService = Depends(get_discovery_service),
):
    return await service.get_public_seller(seller_id)


@router.get("/sellers/{seller_id}/products")
async def get_seller_products(
    seller_id: int,
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = Query(None),
    service: ProductService = Depends(get_product_service),
):
    offset = int(cursor) if cursor and cursor.isdigit() else 0
    products = await service.get_public_seller_products(seller_id, limit=limit, offset=offset)
    return {
        "items": products,
        "next_cursor": str(offset + len(products)) if len(products) == limit else None,
        "limit": limit,
    }