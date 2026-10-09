"""Seller inventory endpoints (PRD §33)."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_roles
from app.core.exceptions import ForbiddenException, NotFoundException
from app.modules.inventory.models import ProductVariant, InventoryTransaction
from app.modules.inventory.service import InventoryService
from app.modules.seller_profile.models import SellerProfile, Product

router = APIRouter()
seller_only = require_roles("seller")


class IncomingUpdate(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: int = Field(..., ge=0)


class ReceiveRequest(BaseModel):
    product_id: int
    variant_id: Optional[int] = None


class AdjustRequest(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    delta: int
    note: Optional[str] = Field(None, max_length=255)


async def _seller_id(db: AsyncSession, user) -> int:
    seller_id = (await db.execute(select(SellerProfile.id).where(SellerProfile.user_id == user.id))).scalar_one_or_none()
    if seller_id is None:
        raise ForbiddenException("Only sellers have inventory")
    return seller_id


async def _own_product(db: AsyncSession, user, product_id: int) -> Product:
    product = await db.get(Product, product_id)
    if not product:
        raise NotFoundException("Product", str(product_id))
    if product.seller_id != await _seller_id(db, user):
        raise ForbiddenException("A seller can only manage their own inventory")
    return product


def _row(product: Product, variant: Optional[ProductVariant] = None) -> dict:
    target = variant or product
    available = target.stock
    reserved = target.reserved_stock or 0
    threshold = product.low_stock_threshold or 5
    return {
        "product_id": product.id,
        "variant_id": variant.id if variant else None,
        "name": product.name,
        "variant_label": variant.label if variant else None,
        "sku": (variant.sku if variant else None) or product.sku,
        "on_hand": available + reserved,
        "reserved": reserved,
        "available_to_sell": available,
        "incoming": target.incoming_stock or 0,
        "low_stock_threshold": threshold,
        "state": "out_of_stock" if available <= 0 else "low_stock" if available <= threshold else "in_stock",
        "product_status": product.status.value if hasattr(product.status, "value") else product.status,
    }


@router.get("")
async def list_inventory(
    state: Optional[str] = Query(None, pattern="^(out_of_stock|low_stock|in_stock)$"),
    user=Depends(seller_only),
    db: AsyncSession = Depends(get_db),
):
    """One row per product, or per variant for products with variants."""
    seller_id = await _seller_id(db, user)
    products = (await db.execute(
        select(Product).where(Product.seller_id == seller_id, Product.status != "deleted").order_by(Product.name)
    )).scalars().all()
    variants: dict[int, list] = {}
    if products:
        for v in (await db.execute(
            select(ProductVariant)
            .where(ProductVariant.product_id.in_([p.id for p in products]), ProductVariant.is_active.is_(True))
            .order_by(ProductVariant.id)
        )).scalars().all():
            variants.setdefault(v.product_id, []).append(v)
    rows = []
    for p in products:
        rows.extend([_row(p, v) for v in variants[p.id]] if p.id in variants else [_row(p)])
    if state:
        rows = [r for r in rows if r["state"] == state]
    return {
        "items": rows,
        "summary": {
            "out_of_stock": sum(1 for r in rows if r["state"] == "out_of_stock"),
            "low_stock": sum(1 for r in rows if r["state"] == "low_stock"),
            "reserved_units": sum(r["reserved"] for r in rows),
            "incoming_units": sum(r["incoming"] for r in rows),
        },
    }


@router.post("/adjust")
async def adjust(data: AdjustRequest, user=Depends(seller_only), db: AsyncSession = Depends(get_db)):
    await _own_product(db, user, data.product_id)
    await InventoryService(db, user.id).adjust(data.product_id, data.variant_id, data.delta, data.note)
    return {"ok": True}


@router.post("/incoming")
async def set_incoming(data: IncomingUpdate, user=Depends(seller_only), db: AsyncSession = Depends(get_db)):
    await _own_product(db, user, data.product_id)
    await InventoryService(db, user.id).set_incoming(data.product_id, data.variant_id, data.quantity)
    return {"ok": True}


@router.post("/receive")
async def receive(data: ReceiveRequest, user=Depends(seller_only), db: AsyncSession = Depends(get_db)):
    await _own_product(db, user, data.product_id)
    received = await InventoryService(db, user.id).receive_incoming(data.product_id, data.variant_id)
    return {"received": received}


@router.get("/transactions")
async def list_transactions(
    product_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(seller_only),
    db: AsyncSession = Depends(get_db),
):
    seller_id = await _seller_id(db, user)
    query = (
        select(InventoryTransaction, Product.name)
        .join(Product, InventoryTransaction.product_id == Product.id)
        .where(Product.seller_id == seller_id)
    )
    if product_id is not None:
        query = query.where(InventoryTransaction.product_id == product_id)
    rows = (await db.execute(query.order_by(InventoryTransaction.id.desc()).limit(limit))).all()
    return [
        {"id": t.id, "product_id": t.product_id, "product_name": name, "variant_id": t.variant_id,
         "order_id": t.order_id, "stock_change": t.stock_change, "reserved_change": t.reserved_change,
         "reason": t.reason, "note": t.note, "created_at": t.created_at}
        for t, name in rows
    ]
