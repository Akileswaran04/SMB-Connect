from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.modules.buyer_discovery.service import DiscoveryService


async def get_discovery_service(
    db: AsyncSession = Depends(get_db),
) -> DiscoveryService:
    return DiscoveryService(db)
