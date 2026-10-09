from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.modules.analytics.service import AnalyticsService


async def get_analytics_service(
    db: AsyncSession = Depends(get_db),
) -> AnalyticsService:
    return AnalyticsService(db)