"""Notification endpoints (in-app inbox; pushed live over the WebSocket)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.modules.notifications.service import NotificationService

router = APIRouter()


@router.get("")
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await NotificationService(db).list(user.id, unread_only, limit)


@router.get("/unread-count")
async def unread_count(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return {"count": await NotificationService(db).unread_count(user.id)}


@router.post("/{notification_id}/read")
async def mark_read(notification_id: int, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return {"updated": await NotificationService(db).mark_read(user.id, notification_id)}


@router.post("/read-all")
async def mark_all_read(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return {"updated": await NotificationService(db).mark_read(user.id)}
