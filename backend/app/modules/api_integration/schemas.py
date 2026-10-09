from typing import List, Optional

from pydantic import BaseModel, Field


class IntegrationConnectResponse(BaseModel):
    service: str
    auth_url: str
    state: str
    mode: str = Field(..., description="'oauth' when provider credentials are configured, 'mock' otherwise")


class IntegrationStatus(BaseModel):
    service: str
    connected: bool
    provider_account: Optional[str] = None
    scopes: Optional[str] = None
    expires_at: Optional[str] = None


class IntegrationListResponse(BaseModel):
    items: List[IntegrationStatus]


class SyncResponse(BaseModel):
    service: str
    created: int
    source: str
    conversation_id: Optional[str] = None
    message_ids: List[str] = []
    note: Optional[str] = None