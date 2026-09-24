from typing import Optional


from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.seller_profile.models import AIInteraction


class AIInteractionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, seller_id: int, data: dict) -> AIInteraction:
        interaction = AIInteraction(seller_id=seller_id, **data)
        self.db.add(interaction)
        await self.db.flush()
        await self.db.refresh(interaction)
        return interaction

    async def get_by_id(self, interaction_id: int) -> Optional[AIInteraction]:
        result = await self.db.execute(
            select(AIInteraction).where(AIInteraction.id == interaction_id)
        )
        return result.scalar_one_or_none()

    async def get_by_seller(self, seller_id: int, limit: int = 50) -> list[AIInteraction]:
        result = await self.db.execute(
            select(AIInteraction)
            .where(AIInteraction.seller_id == seller_id)
            .order_by(AIInteraction.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_stats(self, seller_id: int) -> dict:
        base = select(
            func.count(AIInteraction.id).label("total"),
            func.coalesce(func.sum(func.cast(AIInteraction.was_sent, type_=func.count().type)), 0).label("sent"),
            func.coalesce(func.sum(func.cast(AIInteraction.was_edited, type_=func.count().type)), 0).label("edited"),
            func.coalesce(func.avg(AIInteraction.lead_score), 0).label("avg_score"),
        ).where(AIInteraction.seller_id == seller_id)

        result = await self.db.execute(base)
        row = result.one()

        emotion_result = await self.db.execute(
            select(AIInteraction.emotion, func.count(AIInteraction.id))
            .where(AIInteraction.seller_id == seller_id, AIInteraction.emotion.isnot(None))
            .group_by(AIInteraction.emotion)
        )
        emotions = {row[0]: row[1] for row in emotion_result.all()}

        strategy_result = await self.db.execute(
            select(AIInteraction.strategy, func.count(AIInteraction.id))
            .where(AIInteraction.seller_id == seller_id, AIInteraction.strategy.isnot(None))
            .group_by(AIInteraction.strategy)
        )
        strategies = {row[0]: row[1] for row in strategy_result.all()}

        return {
            "total_interactions": row.total,
            "total_sent": row.sent,
            "total_edited": row.edited,
            "avg_lead_score": round(float(row.avg_score), 1) if row.avg_score else None,
            "emotion_distribution": emotions,
            "strategy_distribution": strategies,
        }
