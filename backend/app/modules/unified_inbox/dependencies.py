from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.modules.unified_inbox.service import InboxService


async def get_inbox_service(
    db: AsyncSession = Depends(get_db),
) -> InboxService:
    return InboxService(db)
