from fastapi import Depends

from app.core.dependencies import get_db
from app.modules.api_integration.service import IntegrationService


async def get_integration_service(db=Depends(get_db)):
    return IntegrationService(db)