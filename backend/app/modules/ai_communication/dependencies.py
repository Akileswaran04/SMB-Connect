from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.modules.ai_communication.service import AICommunicationService


async def get_ai_communication_service(
    db: AsyncSession = Depends(get_db),
) -> AICommunicationService:
    return AICommunicationService(db)
