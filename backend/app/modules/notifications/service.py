"""Notification Service (PRD §58).

Every event is stored as an in-app notification and pushed live over the
WebSocket. Email / SMS / WhatsApp / push go through `_dispatch`: with no
provider configured they are recorded as "logged" so the flow and the
per-user channel settings are real, and plugging in a provider only means
replacing `_dispatch`.
"""
import asyncio
import logging
from typing import Optional

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.redis.realtime import RealtimeService
from app.modules.notifications.models import Notification
from app.modules.seller_profile.models import User, SellerProfile
from app.modules.buyer_profile.models import BuyerProfile

logger = logging.getLogger(__name__)

EXTERNAL_CHANNELS = ("email", "sms", "whatsapp", "push")
_background: set = set()


def _publish_later(user_id: int, payload: dict) -> None:
    """Push to the user's live socket without making the request wait."""
    task = asyncio.create_task(RealtimeService.publish(notification_channel(user_id), "notification:new", payload))
    _background.add(task)
    task.add_done_callback(_background.discard)
DEFAULT_CHANNELS = {"email": True, "sms": True, "whatsapp": False, "push": True}


def notification_channel(user_id: int) -> str:
    return f"notify:{user_id}"


def serialize(n: Notification) -> dict:
    return {
        "id": n.id, "type": n.type, "title": n.title, "body": n.body,
        "data": n.data or {}, "channels": n.channels or {}, "is_read": n.is_read,
        "created_at": n.created_at,
    }


async def _dispatch(channel: str, user: User, title: str, body: Optional[str]) -> str:
    target = user.email if channel == "email" else user.phone
    if channel in ("sms", "whatsapp") and not target:
        return "skipped: no phone number"
    logger.info("[notify:%s] to=%s title=%s", channel, target or user.id, title)
    return "logged"


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _channel_settings(prefs: Optional[dict]) -> dict:
        settings = dict(DEFAULT_CHANNELS)
        settings.update({k: bool(v) for k, v in ((prefs or {}).get("notification_settings") or {}).items()
                         if k in EXTERNAL_CHANNELS})
        return settings

    async def notify(self, user_id: Optional[int], type: str, title: str, body: Optional[str] = None,
                     data: Optional[dict] = None, dedupe_key: Optional[str] = None) -> Optional[Notification]:
        if not user_id:
            return None
        if dedupe_key and (await self.db.execute(
            select(Notification.id).where(Notification.user_id == user_id, Notification.dedupe_key == dedupe_key)
        )).scalar_one_or_none():
            return None
        row = (await self.db.execute(
            select(User, BuyerProfile.preferences)
            .outerjoin(BuyerProfile, BuyerProfile.user_id == User.id)
            .where(User.id == user_id)
        )).first()
        if not row:
            return None
        user, prefs = row

        channels = {"in_app": "delivered"}
        for channel, enabled in self._channel_settings(prefs).items():
            channels[channel] = await _dispatch(channel, user, title, body) if enabled else "off"

        n = Notification(user_id=user_id, type=type, title=title, body=body, data=data or {},
                         channels=channels, dedupe_key=dedupe_key)
        self.db.add(n)
        await self.db.flush()
        _publish_later(user_id, {"notification": serialize(n)})
        return n

    async def notify_order(self, order, type: str, buyer: Optional[tuple] = None, seller: Optional[tuple] = None,
                           data: Optional[dict] = None, dedupe_suffix: Optional[str] = None) -> None:
        """Notify the order's buyer and/or seller; each is (title, body)."""
        payload = {"order_id": order.id, "order_number": order.order_number, **(data or {})}
        key = f"{type}:{order.id}:{dedupe_suffix}" if dedupe_suffix else None
        buyer_uid, seller_uid = (await self.db.execute(
            select(
                select(BuyerProfile.user_id).where(BuyerProfile.id == order.buyer_id).scalar_subquery(),
                select(SellerProfile.user_id).where(SellerProfile.id == order.seller_id).scalar_subquery(),
            )
        )).one()
        if buyer:
            await self.notify(buyer_uid, type, buyer[0], buyer[1], payload, key)
        if seller:
            await self.notify(seller_uid, type, seller[0], seller[1], payload, key)

    async def list(self, user_id: int, unread_only: bool = False, limit: int = 50) -> list[dict]:
        q = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            q = q.where(Notification.is_read.is_(False))
        rows = (await self.db.execute(q.order_by(Notification.id.desc()).limit(limit))).scalars().all()
        return [serialize(n) for n in rows]

    async def unread_count(self, user_id: int) -> int:
        return (await self.db.execute(
            select(func.count(Notification.id)).where(Notification.user_id == user_id, Notification.is_read.is_(False))
        )).scalar() or 0

    async def mark_read(self, user_id: int, notification_id: Optional[int] = None) -> int:
        q = update(Notification).where(Notification.user_id == user_id, Notification.is_read.is_(False))
        if notification_id is not None:
            q = q.where(Notification.id == notification_id)
        result = await self.db.execute(q.values(is_read=True))
        return result.rowcount or 0
