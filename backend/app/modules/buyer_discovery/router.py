from typing import Literal, Optional


from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.infrastructure.redis.ratelimit import rate_limit
from app.modules.assistant.extraction import extract_requirement, search_params_from, known_categories
from app.modules.buyer_discovery.dependencies import get_discovery_service
from app.modules.buyer_discovery.schemas import DiscoveryResponse, SellerPublicResponse
from app.modules.buyer_discovery.service import DiscoveryService
from app.modules.catalogue.models import Category
from app.modules.product_listing.service import ProductService
from app.modules.product_listing.dependencies import get_product_service
from sqlalchemy import select

router = APIRouter()

Sort = Literal["relevance", "newest", "price_asc", "price_desc", "rating", "fastest"]


@router.get("/discover", response_model=DiscoveryResponse)
async def discover(
    category: Optional[str] = Query(None, max_length=100),
    location: Optional[str] = Query(None, max_length=100),
    budget: Optional[float] = Query(None, gt=0, description="Maximum price"),
    min_price: Optional[float] = Query(None, ge=0),
    q: Optional[str] = Query(None, max_length=255),
    seller_id: Optional[int] = Query(None),
    in_stock: bool = Query(False),
    max_delivery_days: Optional[int] = Query(None, ge=1, le=60),
    size: Optional[str] = Query(None, max_length=30),
    color: Optional[str] = Query(None, max_length=40),
    sort: Sort = Query("relevance"),
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = Query(None, description="Opaque offset cursor"),
    service: DiscoveryService = Depends(get_discovery_service),
):
    """Keyword catalogue search with filters and sorting."""
    offset = int(cursor) if cursor and cursor.isdigit() else 0
    return await service.search_products(
        category=category, location=location, budget=budget, q=q, limit=limit, offset=offset,
        min_price=min_price, seller_id=seller_id, in_stock=in_stock, max_delivery_days=max_delivery_days,
        size=size, color=color, sort=sort,
    )


@router.get("/discover/natural", dependencies=[Depends(rate_limit(30, 60, "ai:nl-search"))])
async def discover_natural(
    q: str = Query(..., min_length=2, max_length=300),
    sort: Optional[Sort] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    service: DiscoveryService = Depends(get_discovery_service),
):
    """Natural-language search: 'comfortable black formal shoes under 1500'
    becomes structured filters, then behaves like normal search."""
    extraction = await extract_requirement(db, q)
    params = search_params_from(extraction)
    if sort:
        params["sort"] = sort
    result = await service.search_products(limit=limit, **params)
    if not result["items"] and params.get("q") and params.get("category"):
        params.pop("q")  # the category alone is a better answer than nothing
        result = await service.search_products(limit=limit, **params)
    return {**result, "interpreted": {**extraction, "filters": params}}


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    """Active categories (admin-managed), falling back to product categories."""
    rows = (await db.execute(
        select(Category).where(Category.is_active.is_(True)).order_by(Category.sort_order, Category.name)
    )).scalars().all()
    if rows:
        return [{"name": c.name, "icon": c.icon} for c in rows]
    return [{"name": name, "icon": None} for name in await known_categories(db)]


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
