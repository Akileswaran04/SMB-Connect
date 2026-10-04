from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.modules.human_approval.service import HumanApprovalService


async def get_human_approval_service(
    db: AsyncSession = Depends(get_db),
) -> HumanApprovalService:
    return HumanApprovalService(db)