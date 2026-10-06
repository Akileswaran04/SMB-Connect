import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.security import decode_access_token
from app.core.dependencies import get_db
from app.infrastructure.redis.realtime import RealtimeService
from app.infrastructure.mongodb.chat import utcnow
from app.modules.seller_profile.models import User
from app.modules.unified_inbox.service import InboxService
from app.modules.unified_inbox.schemas import MessageCreate
from app.core.exceptions import ForbiddenException, NotFoundException
from app.modules.notifications.service import notification_channel

logger = logging.getLogger(__name__)

router = APIRouter()


def _dumps(payload: dict) -> str:
    return json.dumps(payload, default=str)


class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, WebSocket] = {}
        self.user_connections: dict[int, set[str]] = {}
        self.conversation_channels: dict[str, set[str]] = {}

    async def connect(self, connection_id: str, user_id: int, ws: WebSocket) -> None:
        await ws.accept()
        self.connections[connection_id] = ws
        self.user_connections.setdefault(user_id, set()).add(connection_id)
        await RealtimeService.set_online(user_id, connection_id)

    async def disconnect(self, connection_id: str, user_id: int) -> None:
        self.connections.pop(connection_id, None)
        conns = self.user_connections.get(user_id, set())
        conns.discard(connection_id)
        if not conns:
            self.user_connections.pop(user_id, None)
            await RealtimeService.set_offline(user_id)
        for channel, members in list(self.conversation_channels.items()):
            members.discard(connection_id)
            if not members:
                self.conversation_channels.pop(channel, None)

    async def subscribe(self, connection_id: str, channel: str) -> None:
        self.conversation_channels.setdefault(channel, set()).add(connection_id)

    def connections_for_channel(self, channel: str) -> list[WebSocket]:
        return [
            self.connections[cid]
            for cid in self.conversation_channels.get(channel, set())
            if cid in self.connections
        ]

    async def broadcast_to_channel(self, channel: str, payload: dict) -> None:
        message = _dumps(payload)
        dead = []
        for ws in self.connections_for_channel(channel):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            cid = next((k for k, v in self.connections.items() if v is ws), None)
            if cid:
                self.connections.pop(cid, None)


manager = ConnectionManager()


_forwarder_task: Optional[asyncio.Task] = None


async def _global_pubsub_forwarder():
    from app.infrastructure.redis import RedisClient

    client = await RedisClient.get_client()
    if client is None:
        return
    pubsub = client.pubsub()
    await pubsub.psubscribe("chat:channel:*")
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message.get("type") == "pmessage":
                channel = message["channel"].decode() if isinstance(message["channel"], bytes) else message["channel"]
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode()
                try:
                    payload = json.loads(data)
                except json.JSONDecodeError:
                    continue
                await manager.broadcast_to_channel(channel, payload)
    except asyncio.CancelledError:
        await pubsub.close()


def start_realtime_forwarder() -> asyncio.Task:
    global _forwarder_task
    if _forwarder_task is None or _forwarder_task.done():
        _forwarder_task = asyncio.create_task(_global_pubsub_forwarder())
    return _forwarder_task


def stop_realtime_forwarder() -> None:
    global _forwarder_task
    if _forwarder_task is not None and not _forwarder_task.done():
        _forwarder_task.cancel()
        _forwarder_task = None


async def _resolve_user(token: str):
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        return None
    async for db in get_db():
        result = await db.execute(select(User).where(User.id == int(payload["sub"])))
        user = result.scalar_one_or_none()
        if user and user.is_active:
            return user
    return None


async def _join(ws: WebSocket, connection_id: str, user, payload: dict, db) -> None:
    conversation_id = payload.get("conversation_id")
    if not conversation_id:
        await ws.send_text(_dumps({"event": "error", "detail": "conversation_id required"}))
        return

    service = InboxService(db)
    convo = await service.convo_repo.get_by_id(conversation_id)
    if not convo:
        await ws.send_text(_dumps({"event": "error", "detail": "Conversation not found"}))
        return
    try:
        await service._assert_participant(user.id, user.role, convo)
    except ForbiddenException:
        await ws.send_text(_dumps({"event": "error", "detail": "Not a participant"}))
        return

    channel = RealtimeService.channel(conversation_id)
    await manager.subscribe(connection_id, channel)
    await RealtimeService.set_online(user.id, connection_id)

    last_seq = payload.get("last_received_sequence")
    if last_seq is not None:
        try:
            last_seq = int(last_seq)
        except (TypeError, ValueError):
            last_seq = None
    if last_seq is not None:
        page = await service.list_messages(
            conversation_id, user.id, user.role, after_sequence=last_seq, limit=200
        )
        await ws.send_text(_dumps({"event": "sync", "conversation_id": conversation_id, **page}))

    await ws.send_text(_dumps({"event": "joined", "conversation_id": conversation_id}))


@router.websocket("/ws/chat")
async def chat_websocket(ws: WebSocket, token: str = ""):
    user = await _resolve_user(token)
    if user is None:
        await ws.close(code=4401)
        return

    connection_id = f"{user.id}:{id(ws)}"
    await manager.connect(connection_id, user.id, ws)
    # Live in-app notifications for this user ride the same socket.
    await manager.subscribe(connection_id, RealtimeService.channel(notification_channel(user.id)))
    logger.info("WS connected: user=%s conn=%s", user.id, connection_id)

    try:
        async for db in get_db():
            service = InboxService(db)

            while True:
                raw = await ws.receive_text()
                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError:
                    await ws.send_text(_dumps({"event": "error", "detail": "Invalid JSON"}))
                    continue

                event = payload.get("type")

                if event == "join":
                    await _join(ws, connection_id, user, payload, db)

                elif event == "send":
                    conversation_id = payload.get("conversation_id")
                    content = payload.get("content")
                    if not conversation_id or not content:
                        await ws.send_text(_dumps({"event": "error", "detail": "conversation_id and content required"}))
                        continue
                    try:
                        message = await service.send_message(
                            conversation_id,
                            user.id,
                            user.role,
                            MessageCreate(
                                content=content,
                                message_type=payload.get("message_type", "text"),
                                source=payload.get("source", "in_app"),
                                client_message_id=payload.get("client_message_id"),
                                attachments=payload.get("attachments", []),
                            ),
                        )
                        await ws.send_text(_dumps({"event": "ack", "message": message}))
                    except (NotFoundException, ForbiddenException) as exc:
                        await ws.send_text(_dumps({"event": "error", "detail": str(exc)}))

                elif event == "typing":
                    conversation_id = payload.get("conversation_id")
                    is_typing = bool(payload.get("is_typing", False))
                    if conversation_id:
                        await RealtimeService.set_typing(conversation_id, user.id, is_typing)
                        await RealtimeService.publish(
                            conversation_id,
                            "typing",
                            {"user_id": user.id, "is_typing": is_typing},
                        )

                elif event == "read":
                    conversation_id = payload.get("conversation_id")
                    if conversation_id:
                        await service.mark_read(conversation_id, user.id, user.role)
                        await RealtimeService.publish(
                            conversation_id,
                            "read",
                            {"user_id": user.id, "conversation_id": conversation_id},
                        )

                elif event == "ping":
                    await RealtimeService.touch_online(user.id)
                    await ws.send_text(_dumps({"event": "pong"}))

    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001 — keep socket alive on transient errors
        logger.warning("WS error: %s", exc)
    finally:
        await manager.disconnect(connection_id, user.id)
        logger.info("WS disconnected: user=%s", user.id)