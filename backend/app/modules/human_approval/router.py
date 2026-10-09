from typing import Optional, List


from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user_id
from app.modules.human_approval.dependencies import get_human_approval_service
from app.modules.human_approval.schemas import (
    DraftResponse, DraftUpdate, DraftStatusUpdate,
)
from app.modules.human_approval.service import HumanApprovalService

router = APIRouter()


@router.post("/conversations/{conversation_id}/drafts", response_model=DraftResponse)
async def generate_draft(
    conversation_id: str,
    reply_to_message_id: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    service: HumanApprovalService = Depends(get_human_approval_service),
):
    return await service.generate_draft(int(user_id), conversation_id, reply_to_message_id)


@router.get("/conversations/{conversation_id}/drafts", response_model=List[DraftResponse])
async def list_drafts(
    conversation_id: str,
    status: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    service: HumanApprovalService = Depends(get_human_approval_service),
):
    return await service.list_drafts(int(user_id), conversation_id, status=status)


@router.put("/ai/drafts/{draft_id}", response_model=DraftResponse)
async def edit_draft(
    draft_id: str,
    data: DraftUpdate,
    user_id: str = Depends(get_current_user_id),
    service: HumanApprovalService = Depends(get_human_approval_service),
):
    return await service.edit_draft(int(user_id), draft_id, data.content)


@router.patch("/ai/drafts/{draft_id}/status", response_model=DraftResponse)
async def set_draft_status(
    draft_id: str,
    data: DraftStatusUpdate,
    user_id: str = Depends(get_current_user_id),
    service: HumanApprovalService = Depends(get_human_approval_service),
):
    return await service.set_status(int(user_id), draft_id, data.status)


@router.post("/ai/drafts/{draft_id}/send")
async def send_draft(
    draft_id: str,
    user_id: str = Depends(get_current_user_id),
    service: HumanApprovalService = Depends(get_human_approval_service),
):
    return await service.send_draft(int(user_id), draft_id)