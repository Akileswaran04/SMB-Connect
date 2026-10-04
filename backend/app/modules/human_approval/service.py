from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.mongodb.chat import get_messages_collection
from app.modules.human_approval.repository import DraftRepository
from app.modules.unified_inbox.repository import ConversationRepository
from app.modules.unified_inbox.service import InboxService
from app.modules.unified_inbox.schemas import MessageCreate
from app.modules.seller_profile.models import SellerProfile
from app.modules.ai_communication.sentiment import analyze_message
from app.core.exceptions import NotFoundException, ForbiddenException, ValidationException
from bson import ObjectId


class HumanApprovalService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.draft_repo = DraftRepository()
        self.convo_repo = ConversationRepository()

    async def _get_seller_id_from_user(self, user_id: int) -> int:
        result = await self.db.execute(
            select(SellerProfile).where(SellerProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise NotFoundException("SellerProfile", str(user_id))
        return profile.id

    async def _assert_owner(self, user_id: int, draft: dict) -> None:
        seller_id = await self._get_seller_id_from_user(user_id)
        if draft.get("sellerId") != seller_id:
            raise ForbiddenException("Draft belongs to another seller")

    async def generate_draft(
        self, user_id: int, conversation_id: str, reply_to_message_id: Optional[str] = None
    ) -> dict:
        seller_id = await self._get_seller_id_from_user(user_id)

        convo = await self.convo_repo.get_by_id(conversation_id)
        if not convo:
            raise NotFoundException("Conversation", conversation_id)
        if convo.get("sellerId") != seller_id:
            raise ForbiddenException("Not your conversation")

        messages = await get_messages_collection()
        last = None
        if reply_to_message_id and ObjectId.is_valid(reply_to_message_id):
            last = await messages.find_one({"_id": ObjectId(reply_to_message_id)})
        if not last:
            last = await (
                messages.find({"conversationId": ObjectId(conversation_id)})
                .sort("createdAt", -1)
                .limit(1)
                .to_list(length=1)
            )
            last = last[0] if last else None
        if not last:
            raise ValidationException("No messages to draft a reply to")

        original = last.get("content", "")
        analysis = await analyze_message(original, llm_draft=True)

        draft = await self.draft_repo.create({
            "conversationId": ObjectId(conversation_id),
            "sellerId": seller_id,
            "replyToMessageId": str(last["_id"]),
            "originalMessage": original,
            "intent": analysis["intent"],
            "sentimentLabel": analysis["label"],
            "leadScore": analysis["lead_score"],
            "draftContent": analysis["draft"],
        })
        return self._to_response(draft)

    async def list_drafts(
        self, user_id: int, conversation_id: str, status: Optional[str] = None
    ) -> list:
        seller_id = await self._get_seller_id_from_user(user_id)
        convo = await self.convo_repo.get_by_id(conversation_id)
        if not convo:
            raise NotFoundException("Conversation", conversation_id)
        if convo.get("sellerId") != seller_id:
            raise ForbiddenException("Not your conversation")
        docs = await self.draft_repo.list_for_conversation(conversation_id, status=status)
        return [self._to_response(d) for d in docs]

    async def edit_draft(self, user_id: int, draft_id: str, content: str) -> dict:
        draft = await self.draft_repo.get_by_id(draft_id)
        if not draft:
            raise NotFoundException("Draft", draft_id)
        await self._assert_owner(user_id, draft)
        updated = await self.draft_repo.update_content(draft_id, content)
        return self._to_response(updated)

    async def set_status(self, user_id: int, draft_id: str, status: str) -> dict:
        draft = await self.draft_repo.get_by_id(draft_id)
        if not draft:
            raise NotFoundException("Draft", draft_id)
        await self._assert_owner(user_id, draft)
        updated = await self.draft_repo.update_status(draft_id, status)
        return self._to_response(updated)

    async def send_draft(self, user_id: int, draft_id: str) -> dict:
        draft = await self.draft_repo.get_by_id(draft_id)
        if not draft:
            raise NotFoundException("Draft", draft_id)
        await self._assert_owner(user_id, draft)
        if draft.get("status") in ("rejected",):
            raise ValidationException("Rejected drafts cannot be sent")
        if draft.get("status") == "sent":
            raise ValidationException("Draft already sent")

        conversation_id = str(draft["conversationId"])
        inbox = InboxService(self.db)
        message = await inbox.send_message(
            conversation_id,
            user_id,
            "seller",
            MessageCreate(
                content=draft["draftContent"],
                message_type="text",
                source="in_app",
                client_message_id=f"draft:{draft_id}",
            ),
        )
        await self.draft_repo.mark_sent(draft_id)
        return {"draft": self._to_response(draft), "message": message}

    def _to_response(self, draft: dict) -> dict:
        return {
            "id": str(draft["_id"]),
            "conversation_id": str(draft["conversationId"]),
            "seller_id": draft.get("sellerId"),
            "reply_to_message_id": draft.get("replyToMessageId"),
            "original_message": draft.get("originalMessage"),
            "intent": draft.get("intent"),
            "sentiment_label": draft.get("sentimentLabel"),
            "lead_score": draft.get("leadScore"),
            "draft_content": draft.get("draftContent"),
            "status": draft.get("status", "pending"),
            "created_at": draft.get("createdAt"),
            "reviewed_at": draft.get("reviewedAt"),
        }