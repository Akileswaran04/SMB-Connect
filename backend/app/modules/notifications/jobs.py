"""Periodic notification jobs: shipment-delay alerts and reorder reminders
(PRD §58). Both are idempotent (dedupe keys), so running them often is safe."""
import logging
from datetime import datetime, timedelta

from sqlalchemy import select, func

from app.infrastructure.postgres.database import AsyncSessionLocal
from app.modules.orders.models import Order, OrderItem, TrackingEvent
from app.modules.notifications.service import NotificationService
from app.modules.platform.service import PlatformSettingsService
from app.modules.seller_profile.models import Product
from app.modules.shipments.service import ShipmentService

logger = logging.getLogger(__name__)
CONSUMABLE_CATEGORIES = ("groceries", "food & spices", "food", "business supplies", "personal care")


async def send_reorder_reminders(db) -> int:
    days = float(await PlatformSettingsService(db).get("reorder_reminder_days"))
    cutoff = datetime.utcnow() - timedelta(days=days)
    rows = (await db.execute(
        select(Order, func.max(TrackingEvent.created_at))
        .join(TrackingEvent, TrackingEvent.order_id == Order.id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(Product, Product.id == OrderItem.product_id)
        .where(Order.status == "delivered", TrackingEvent.status == "delivered",
               func.lower(Product.category).in_(CONSUMABLE_CATEGORIES))
        .group_by(Order.id)
        .having(func.max(TrackingEvent.created_at) < cutoff)
    )).all()
    sent = 0
    notifications = NotificationService(db)
    for order, _delivered in rows:
        await notifications.notify_order(
            order, "reorder_reminder",
            buyer=("Time to reorder?", f"It's been a while since order {order.order_number}. Buy again in one tap."),
            dedupe_suffix="reorder",
        )
        sent += 1
    return sent


async def run_notification_jobs() -> None:
    async with AsyncSessionLocal() as db:
        try:
            late = await ShipmentService(db).notify_delays()
            reminders = await send_reorder_reminders(db)
            await db.commit()
            if late or reminders:
                logger.info("Notification jobs: %s delay alerts, %s reorder reminders checked", late, reminders)
        except Exception:
            await db.rollback()
            logger.warning("Notification jobs failed", exc_info=True)
