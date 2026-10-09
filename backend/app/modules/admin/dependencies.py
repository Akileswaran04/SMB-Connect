from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.modules.admin.service import AdminService


async def get_admin_service(
    db: AsyncSession = Depends(get_db),
) -> AdminService:
    return AdminService(db)