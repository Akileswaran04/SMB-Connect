"""Assistant module dependencies."""
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.modules.assistant.service import AssistantService


async def get_assistant_service(
    db: AsyncSession = Depends(get_db),
) -> AssistantService:
    """Provide AssistantService with database session."""
    return AssistantService(db)
