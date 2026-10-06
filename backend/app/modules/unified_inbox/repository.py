from typing import Optional

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING

from app.infrastructure.mongodb.chat import (
    get_conversations_collection,
    get_messages_collection,
    utcnow,
)


def to_str_id(doc) -> Optional[str]:
    return str(doc["_id"]) if doc else None


def serialize(doc) -> dict:
    if not doc:
        return None
    out = {}
    for key, value in doc.items():
        if key == "_id":
            out["id"] = str(value)
        elif key == "conversationId" and value:
            out["conversation_id"] = str(value)
        elif key == "clientMessageId":
            continue
        else:
            out[key] = value
    return out


class ConversationRepository:
    async def get_or_create(self, seller_id: int, buyer_id: int) -> dict:
        convos = await get_conversations_collection()
        now = utcnow()

        existing = await convos.find_one(
            {"sellerId": seller_id, "buyerId": buyer_id}
        )
        if existing:
            return existing

        doc = {
            "sellerId": seller_id,
            "buyerId": buyer_id,
            "status": "active",
            "lastMessage": None,
            "lastMessageAt": None,
            "unreadCount": 0,
            "createdAt": now,
            "updatedAt": now,
        }
        try:
            result = await convos.insert_one(doc)
            return await convos.find_one({"_id": result.inserted_id})
        except Exception:
            return await convos.find_one({"sellerId": seller_id, "buyerId": buyer_id})

    async def get_by_id(self, conversation_id: str) -> Optional[dict]:
        if not ObjectId.is_valid(conversation_id):
            return None
        convos = await get_conversations_collection()
        return await convos.find_one({"_id": ObjectId(conversation_id)})

    async def list_for_participant(
        self, user_id: int, user_role: str, cursor: Optional[str] = None, limit: int = 50
    ) -> tuple[list, Optional[str]]:
        convos = await get_conversations_collection()
        field = "sellerId" if user_role == "seller" else "buyerId"

        query = {field: user_id}
        if cursor and ObjectId.is_valid(cursor):
            query["_id"] = {"$lt": ObjectId(cursor)}

        docs = await (
            convos.find(query)
            .sort("lastMessageAt", DESCENDING)
            .limit(limit + 1)
            .to_list(length=limit + 1)
        )
        has_more = len(docs) > limit
        docs = docs[:limit]
        next_cursor = str(docs[-1]["_id"]) if has_more and docs else None
        return docs, next_cursor

    async def update_last_message(
        self, conversation_id: str, content: str, recipient_id: int
    ) -> None:
        convos = await get_conversations_collection()
        await convos.update_one(
            {"_id": ObjectId(conversation_id)},
            {
                "$set": {
                    "lastMessage": content,
                    "lastMessageAt": utcnow(),
                    "updatedAt": utcnow(),
                    "unreadFor": recipient_id,
                },
            },
        )

    async def increment_unread(self, conversation_id: str, recipient_id: int) -> None:
        convos = await get_conversations_collection()
        await convos.update_one(
            {"_id": ObjectId(conversation_id)},
            {
                "$inc": {"unreadCount": 1},
                "$set": {"unreadFor": recipient_id, "updatedAt": utcnow()},
            },
        )

    async def mark_read(self, conversation_id: str, reader_id: int) -> None:
        convos = await get_conversations_collection()
        messages = await get_messages_collection()

        await messages.update_many(
            {
                "conversationId": ObjectId(conversation_id),
                "senderId": {"$ne": reader_id},
                "readAt": None,
            },
            {"$set": {"readAt": utcnow()}},
        )
        await convos.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"unreadCount": 0, "unreadFor": reader_id, "updatedAt": utcnow()}},
        )


class MessageRepository:
    async def find_by_client_message_id(self, client_message_id: str) -> Optional[dict]:
        messages = await get_messages_collection()
        return await messages.find_one({"clientMessageId": client_message_id})

    async def next_sequence(self, conversation_id: str) -> int:
        messages = await get_messages_collection()
        last = await (
            messages.find({"conversationId": ObjectId(conversation_id)})
            .sort("sequenceNumber", DESCENDING)
            .limit(1)
            .to_list(length=1)
        )
        return (last[0]["sequenceNumber"] + 1) if last else 1

    async def create(self, data: dict) -> dict:
        messages = await get_messages_collection()
        result = await messages.insert_one(data)
        return await messages.find_one({"_id": result.inserted_id})

    async def get_page(
        self,
        conversation_id: str,
        cursor: Optional[str] = None,
        limit: int = 50,
        after_sequence: Optional[int] = None,
    ) -> tuple[list, Optional[str]]:
        messages = await get_messages_collection()
        query = {"conversationId": ObjectId(conversation_id)}

        if after_sequence is not None:
            query["sequenceNumber"] = {"$gt": after_sequence}
            docs = await (
                messages.find(query)
                .sort("sequenceNumber", ASCENDING)
                .to_list(length=limit + 1)
            )
            has_more = len(docs) > limit
            docs = docs[:limit]
            next_cursor = str(docs[-1]["_id"]) if has_more and docs else None
            return docs, next_cursor

        if cursor and ObjectId.is_valid(cursor):
            query["_id"] = {"$lt": ObjectId(cursor)}

        docs = await (
            messages.find(query)
            .sort("_id", DESCENDING)
            .limit(limit + 1)
            .to_list(length=limit + 1)
        )
        has_more = len(docs) > limit
        docs = docs[:limit]
        docs.reverse()
        next_cursor = str(docs[0]["_id"]) if has_more and docs else None
        return docs, next_cursor

    async def mark_ai_generated(self, message_id: str) -> None:
        messages = await get_messages_collection()
        await messages.update_one(
            {"_id": ObjectId(message_id)},
            {"$set": {"isAiGenerated": True}},
        )

    async def update_sentiment(self, message_id, sentiment: dict) -> None:
        messages = await get_messages_collection()
        await messages.update_one(
            {"_id": ObjectId(message_id) if isinstance(message_id, str) else message_id},
            {"$set": {"sentiment": sentiment}},
        )

    async def update_translation(self, message_id, translated_content: str, translated_language: str) -> None:
        messages = await get_messages_collection()
        await messages.update_one(
            {"_id": ObjectId(message_id) if isinstance(message_id, str) else message_id},
            {"$set": {"translatedContent": translated_content, "translatedLanguage": translated_language}},
        )