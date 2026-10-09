"""Negotiation Repository — database operations only."""
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.negotiation.models import NegotiationRule, NegotiationOffer


class NegotiationRepository:
    """Repository for negotiation_rules/negotiation_offers."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Rules ──

    async def get_rule(self, product_id: int) -> Optional[NegotiationRule]:
        result = await self.db.execute(select(NegotiationRule).where(NegotiationRule.product_id == product_id))
        return result.scalar_one_or_none()

    async def upsert_rule(self, product_id: int, data: dict) -> NegotiationRule:
        existing = await self.get_rule(product_id)
        if existing:
            await self.db.execute(
                update(NegotiationRule).where(NegotiationRule.product_id == product_id).values(**data)
            )
            await self.db.flush()
            return await self.get_rule(product_id)
        rule = NegotiationRule(product_id=product_id, **data)
        self.db.add(rule)
        await self.db.flush()
        await self.db.refresh(rule)
        return rule

    # ── Offers ──

    async def get_offer(self, offer_id: int) -> Optional[NegotiationOffer]:
        result = await self.db.execute(
            select(NegotiationOffer).options(joinedload(NegotiationOffer.product)).where(NegotiationOffer.id == offer_id)
        )
        return result.scalar_one_or_none()

    async def list_thread(self, product_id: int, buyer_id: int) -> list[NegotiationOffer]:
        result = await self.db.execute(
            select(NegotiationOffer)
            .options(joinedload(NegotiationOffer.product))
            .where(NegotiationOffer.product_id == product_id, NegotiationOffer.buyer_id == buyer_id)
            .order_by(NegotiationOffer.round.asc(), NegotiationOffer.id.asc())
        )
        return list(result.scalars().all())

    async def list_for_seller(self, seller_id: int, status: Optional[str] = None) -> list[NegotiationOffer]:
        query = (
            select(NegotiationOffer)
            .options(joinedload(NegotiationOffer.product))
            .where(NegotiationOffer.seller_id == seller_id)
        )
        if status:
            query = query.where(NegotiationOffer.status == status)
        query = query.order_by(NegotiationOffer.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def list_for_buyer(self, buyer_id: int, status: Optional[str] = None) -> list[NegotiationOffer]:
        query = (
            select(NegotiationOffer)
            .options(joinedload(NegotiationOffer.product))
            .where(NegotiationOffer.buyer_id == buyer_id)
        )
        if status:
            query = query.where(NegotiationOffer.status == status)
        query = query.order_by(NegotiationOffer.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create_offer(self, data: dict) -> NegotiationOffer:
        offer = NegotiationOffer(**data)
        self.db.add(offer)
        await self.db.flush()
        return await self.get_offer(offer.id)

    async def update_offer(self, offer_id: int, data: dict) -> Optional[NegotiationOffer]:
        await self.db.execute(update(NegotiationOffer).where(NegotiationOffer.id == offer_id).values(**data))
        await self.db.flush()
        return await self.get_offer(offer_id)
