from typing import Optional


from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user
from app.modules.unified_inbox.dependencies import get_inbox_service
from app.modules.unified_inbox.schemas import (
    ConversationCreate, ConversationResponse, MessageCreate, MessageResponse,
)
from app.modules.unified_inbox.service import InboxService

router = APIRouter()


@router.post("", response_model=ConversationResponse)
async def create_conversation(
    data: ConversationCreate,
    user=Depends(get_current_user),
    service: InboxService = Depends(get_inbox_service),
):
    return await service.get_or_create_conversation(user.id, user.role, data)


@router.get("/unread/total")
async def get_unread_total(
    user=Depends(get_current_user),
    service: InboxService = Depends(get_inbox_service),
):
    total = await service.get_unread_total(user.id, user.role)
    return {"total": total}


@router.get("")
async def list_conversations(
    cursor: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    user=Depends(get_current_user),
    service: InboxService = Depends(get_inbox_service),
):
    return await service.list_conversations(user.id, user.role, cursor=cursor, limit=limit)


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    user=Depends(get_current_user),
    service: InboxService = Depends(get_inbox_service),
):
    return await service.get_conversation(conversation_id, user.id, user.role)


@router.get("/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    cursor: Optional[str] = Query(None, description="Opaque _id cursor"),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(get_current_user),
    service: InboxService = Depends(get_inbox_service),
):
    return await service.list_messages(
        conversation_id, user.id, user.role, cursor=cursor, limit=limit
    )


@router.post("/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: str,
    data: MessageCreate,
    user=Depends(get_current_user),
    service: InboxService = Depends(get_inbox_service),
):
    return await service.send_message(conversation_id, user.id, user.role, data)


@router.patch("/{conversation_id}/read")
async def mark_read(
    conversation_id: str,
    user=Depends(get_current_user),
    service: InboxService = Depends(get_inbox_service),
):
    return await service.mark_read(conversation_id, user.id, user.role)