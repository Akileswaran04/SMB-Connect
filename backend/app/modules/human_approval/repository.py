from typing import Optional

from bson import ObjectId
from pymongo import DESCENDING

from app.infrastructure.mongodb.chat import get_drafts_collection, utcnow


class DraftRepository:
    async def create(self, data: dict) -> dict:
        drafts = await get_drafts_collection()
        data["createdAt"] = utcnow()
        data["status"] = "pending"
        result = await drafts.insert_one(data)
        return await drafts.find_one({"_id": result.inserted_id})

    async def get_by_id(self, draft_id: str) -> Optional[dict]:
        if not ObjectId.is_valid(draft_id):
            return None
        drafts = await get_drafts_collection()
        return await drafts.find_one({"_id": ObjectId(draft_id)})

    async def list_for_conversation(
        self, conversation_id: str, status: Optional[str] = None, limit: int = 50
    ) -> list[dict]:
        drafts = await get_drafts_collection()
        query = {"conversationId": ObjectId(conversation_id)}
        if status:
            query["status"] = status
        return await (
            drafts.find(query)
            .sort("createdAt", DESCENDING)
            .limit(limit)
            .to_list(length=limit)
        )

    async def update_status(self, draft_id: str, status: str) -> Optional[dict]:
        drafts = await get_drafts_collection()
        await drafts.update_one(
            {"_id": ObjectId(draft_id)},
            {"$set": {"status": status, "reviewedAt": utcnow()}},
        )
        return await self.get_by_id(draft_id)

    async def update_content(self, draft_id: str, content: str) -> Optional[dict]:
        drafts = await get_drafts_collection()
        await drafts.update_one(
            {"_id": ObjectId(draft_id)},
            {"$set": {"draftContent": content}},
        )
        return await self.get_by_id(draft_id)

    async def mark_sent(self, draft_id: str) -> None:
        drafts = await get_drafts_collection()
        await drafts.update_one(
            {"_id": ObjectId(draft_id)},
            {"$set": {"status": "sent", "reviewedAt": utcnow()}},
        )