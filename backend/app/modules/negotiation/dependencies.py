"""Negotiation module dependencies."""
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.modules.negotiation.service import NegotiationService


async def get_negotiation_service(
    db: AsyncSession = Depends(get_db),
) -> NegotiationService:
    """Provide NegotiationService with database session."""
    return NegotiationService(db)
