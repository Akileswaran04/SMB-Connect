import asyncio
import logging
import time
from datetime import datetime

from sqlalchemy import select, func, delete, cast, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.postgres.database import AsyncSessionLocal
from app.infrastructure.mongodb.chat import get_messages_collection, get_conversations_collection
from app.modules.seller_profile.models import SellerProfile
from app.modules.orders.models import Order, orderstatus_enum
from app.modules.orders.models import Review
from app.modules.analytics.models import AnalyticsSummary, TrustScore

logger = logging.getLogger(__name__)


async def _compute_seller_metrics(db: AsyncSession, seller_id: int) -> dict:
    orders_result = await db.execute(
        select(
            func.count(Order.id),
            # Cancelled and refunded orders are not revenue.
            func.coalesce(func.sum(case(
                (Order.status.in_([cast("cancelled", orderstatus_enum), cast("refunded", orderstatus_enum)]), 0),
                else_=Order.total_amount,
            )), 0),
            func.count(func.nullif(Order.status, cast("cancelled", orderstatus_enum))),
        ).where(Order.seller_id == seller_id)
    )
    total_orders, total_revenue, successful_orders = orders_result.one()

    cancelled_result = await db.execute(
        select(func.count(Order.id)).where(
            Order.seller_id == seller_id,
            Order.status == cast("cancelled", orderstatus_enum),
        )
    )
    cancelled = cancelled_result.scalar() or 0

    reviews_result = await db.execute(
        select(func.avg(Review.rating)).where(Review.seller_id == seller_id)
    )
    avg_rating = reviews_result.scalar()
    avg_rating = float(avg_rating) if avg_rating is not None else 0.0

    response_time_avg = await _compute_response_time(seller_id)

    total_orders = total_orders or 0
    total_revenue = float(total_revenue or 0.0)
    successful_orders = successful_orders or 0
    average_order_value = round(total_revenue / successful_orders, 2) if successful_orders else 0.0
    cancellation_rate = round(cancelled / total_orders, 3) if total_orders else 0.0
    conversion_rate = round(successful_orders / max(total_orders, 1), 3)

    review_score = round((avg_rating or 0) * 20, 1)
    compliance_score = 70.0
    communication_score = 60.0 if response_time_avg is None else max(0, round(100 - response_time_avg / 60, 1))
    overall = round(
        0.4 * review_score + 0.2 * compliance_score + 0.2 * communication_score
        + 0.2 * (100 * (1 - cancellation_rate)),
        1,
    )

    return {
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "average_order_value": average_order_value,
        "conversion_rate": conversion_rate,
        "response_time_avg": round(response_time_avg, 1) if response_time_avg else None,
        "cancelled": cancelled,
        "successful_orders": successful_orders,
        "cancellation_rate": cancellation_rate,
        "review_score": review_score,
        "communication_score": communication_score,
        "overall_score": overall,
    }


async def _compute_response_time(seller_id: int):
    try:
        messages = await get_messages_collection()
        convos = await get_conversations_collection()
        convos = await asyncio.wait_for(
            convos.find({"sellerId": seller_id}, {"_id": 1})
            .sort([("lastMessageAt", -1)])
            .limit(200)
            .to_list(length=200),
            timeout=5,
        )
        convo_ids = [c["_id"] for c in convos]
        if not convo_ids:
            return None

        docs = await asyncio.wait_for(
            messages.find({"conversationId": {"$in": convo_ids}})
            .sort([("createdAt", 1)])
            .to_list(length=1000),
            timeout=5,
        )
        gaps = []
        for prev, cur in zip(docs, docs[1:]):
            if prev.get("senderType") == "buyer" and cur.get("senderType") == "seller":
                try:
                    delta = (cur["createdAt"] - prev["createdAt"]).total_seconds()
                    if 0 < delta < 60 * 60 * 24 * 7:
                        gaps.append(delta)
                except (TypeError, KeyError):
                    continue
        if not gaps:
            return None
        return sum(gaps) / len(gaps)
    except asyncio.TimeoutError:
        logger.warning("Response-time computation timed out for seller %s", seller_id)
        return None
    except Exception as exc:  # noqa: BLE001 — Mongo optional for analytics
        logger.warning("Response-time computation failed: %s", exc)
        return None


async def compute_for_seller(seller_id: int) -> None:
    async with AsyncSessionLocal() as db:
        try:
            metrics = await _compute_seller_metrics(db, seller_id)

            await db.execute(
                delete(AnalyticsSummary).where(AnalyticsSummary.seller_id == seller_id)
            )
            summary = AnalyticsSummary(
                seller_id=seller_id,
                date=datetime.utcnow(),
                total_orders=metrics["total_orders"],
                total_revenue=metrics["total_revenue"],
                average_order_value=metrics["average_order_value"],
                conversion_rate=metrics["conversion_rate"],
                response_time_avg=metrics["response_time_avg"],
                total_sales=metrics["total_revenue"],
            )
            db.add(summary)

            existing = await db.execute(
                select(TrustScore).where(TrustScore.seller_id == seller_id)
            )
            trust = existing.scalar_one_or_none()
            if trust is None:
                trust = TrustScore(seller_id=seller_id)
                db.add(trust)
            trust.overall_score = metrics["overall_score"]
            trust.review_score = metrics["review_score"]
            trust.communication_score = metrics["communication_score"]
            trust.successful_orders = metrics["successful_orders"]
            trust.cancellation_rate = metrics["cancellation_rate"]
            trust.last_updated = datetime.utcnow()

            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("Analytics computation failed for seller %s", seller_id)


async def compute_all() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SellerProfile.id))
        seller_ids = [row[0] for row in result.all()]
    start = time.monotonic()
    logger.info("Computing analytics for %d sellers", len(seller_ids))
    semaphore = asyncio.Semaphore(5)

    async def _run(seller_id: int) -> None:
        async with semaphore:
            await compute_for_seller(seller_id)

    await asyncio.gather(*(_run(s) for s in seller_ids))
    logger.info("Analytics computation finished in %.1fs", time.monotonic() - start)