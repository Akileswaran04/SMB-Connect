import json
import logging
from typing import Any, Optional

from app.infrastructure.redis import RedisClient

logger = logging.getLogger(__name__)

ONLINE_TTL = 60
TYPING_TTL = 8


class RealtimeService:
    @staticmethod
    async def set_online(user_id: int, connection_id: str = "") -> None:
        client = await RedisClient.get_client()
        if client is None:
            return
        await client.set(f"user:{user_id}:online", "1", ex=ONLINE_TTL)
        if connection_id:
            await client.set(f"ws:session:{connection_id}", str(user_id), ex=3600)

    @staticmethod
    async def set_offline(user_id: int, connection_id: str = "") -> None:
        client = await RedisClient.get_client()
        if client is None:
            return
        if connection_id:
            await client.delete(f"ws:session:{connection_id}")
        await client.delete(f"user:{user_id}:online")

    @staticmethod
    async def is_online(user_id: int) -> bool:
        client = await RedisClient.get_client()
        if client is None:
            return False
        return bool(await client.exists(f"user:{user_id}:online"))

    @staticmethod
    async def touch_online(user_id: int) -> None:
        client = await RedisClient.get_client()
        if client is None:
            return
        await client.expire(f"user:{user_id}:online", ONLINE_TTL)


    @staticmethod
    async def set_typing(conversation_id: str, user_id: int, is_typing: bool) -> None:
        client = await RedisClient.get_client()
        if client is None:
            return
        key = f"conversation:{conversation_id}:typing"
        if is_typing:
            await client.sadd(key, str(user_id))
            await client.expire(key, TYPING_TTL)
        else:
            await client.srem(key, str(user_id))

    @staticmethod
    async def typing_users(conversation_id: str) -> list[int]:
        client = await RedisClient.get_client()
        if client is None:
            return []
        members = await client.smembers(f"conversation:{conversation_id}:typing")
        return [int(m) for m in members if m.isdigit()]


    @staticmethod
    async def get_unread(user_id: int) -> dict:
        client = await RedisClient.get_client()
        if client is None:
            return {}
        raw = await client.hgetall(f"user:{user_id}:unread")
        return {k: int(v) for k, v in raw.items() if v.isdigit()}

    @staticmethod
    async def get_unread_total(user_id: int) -> int:
        return sum((await RealtimeService.get_unread(user_id)).values())


    @staticmethod
    def channel(conversation_id: str) -> str:
        return f"chat:channel:{conversation_id}"

    @staticmethod
    async def publish(conversation_id: str, event: str, payload: dict) -> None:
        client = await RedisClient.get_client()
        if client is None:
            return
        try:
            await client.publish(
                RealtimeService.channel(conversation_id),
                json.dumps({"event": event, **payload}, default=str),
            )
        except Exception as e:
            logger.warning("Redis publish failed: %s", e)


    @staticmethod
    async def user_for_connection(connection_id: str) -> Optional[str]:
        client = await RedisClient.get_client()
        if client is None:
            return None
        return await client.get(f"ws:session:{connection_id}")