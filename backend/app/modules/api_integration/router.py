from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, require_roles
from app.modules.api_integration.dependencies import get_integration_service
from app.modules.api_integration.schemas import (
    IntegrationConnectResponse, IntegrationListResponse, IntegrationStatus,
    SyncResponse,
)
from app.modules.api_integration.service import IntegrationService
from app.modules.seller_profile.models import User

router = APIRouter()


@router.post("/integrations/{service}/connect", response_model=IntegrationConnectResponse)
async def connect(
    service: str,
    user: User = Depends(require_roles("seller")),
    service_obj: IntegrationService = Depends(get_integration_service),
):
    return await service_obj.connect(user, service)


@router.get("/integrations/{service}/callback")
async def callback(
    service: str,
    code: str = Query(...),
    state: str = Query(...),
    service_obj: IntegrationService = Depends(get_integration_service),
):
    result = await service_obj.callback(service, code, state)
    return {
        **result,
        "detail": f"{'Google Mail' if service == 'gmail' else 'Microsoft Outlook'} connected — you can close this tab.",
    }


@router.get("/integrations", response_model=IntegrationListResponse)
async def list_integrations(
    user: User = Depends(get_current_user),
    service_obj: IntegrationService = Depends(get_integration_service),
):
    items = await service_obj.list_integrations(user)
    return IntegrationListResponse(items=[IntegrationStatus(**i) for i in items])


@router.delete("/integrations/{service}")
async def disconnect(
    service: str,
    user: User = Depends(get_current_user),
    service_obj: IntegrationService = Depends(get_integration_service),
):
    return await service_obj.disconnect(user, service)


@router.post("/integrations/{service}/sync", response_model=SyncResponse)
async def sync(
    service: str,
    user: User = Depends(require_roles("seller")),
    service_obj: IntegrationService = Depends(get_integration_service),
):
    return await service_obj.sync(user, service)