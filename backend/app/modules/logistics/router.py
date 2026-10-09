"""Logistics partner endpoints — profile, dashboard, partner directory."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_roles
from app.core.exceptions import NotFoundException
from app.modules.logistics.models import LogisticsProfile
from app.modules.seller_profile.models import User
from app.modules.shipments.service import ShipmentService

router = APIRouter()
partner_only = require_roles("logistics")


class LogisticsProfileUpdate(BaseModel):
    company_name: Optional[str] = Field(None, min_length=1, max_length=255)
    contact_name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    vehicle_type: Optional[str] = Field(None, max_length=50)
    vehicle_number: Optional[str] = Field(None, max_length=30)
    service_city: Optional[str] = Field(None, max_length=100)
    is_available: Optional[bool] = None


def _profile(p: LogisticsProfile) -> dict:
    return {"id": p.id, "company_name": p.company_name, "contact_name": p.contact_name, "phone": p.phone,
            "vehicle_type": p.vehicle_type, "vehicle_number": p.vehicle_number,
            "service_city": p.service_city, "is_available": p.is_available}


async def _mine(db: AsyncSession, user) -> LogisticsProfile:
    profile = (await db.execute(select(LogisticsProfile).where(LogisticsProfile.user_id == user.id))).scalar_one_or_none()
    if not profile:
        raise NotFoundException("LogisticsProfile", str(user.id))
    return profile


@router.get("/me")
async def get_me(user=Depends(partner_only), db: AsyncSession = Depends(get_db)):
    return _profile(await _mine(db, user))


@router.put("/me")
async def update_me(data: LogisticsProfileUpdate, user=Depends(partner_only), db: AsyncSession = Depends(get_db)):
    profile = await _mine(db, user)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)
    profile.updated_at = datetime.utcnow()
    await db.flush()
    return _profile(profile)


@router.get("/dashboard")
async def dashboard(user=Depends(partner_only), db: AsyncSession = Depends(get_db)):
    return await ShipmentService(db).partner_dashboard(user)


@router.get("/partners")
async def list_partners(user=Depends(require_roles("seller", "admin")), db: AsyncSession = Depends(get_db)):
    """Available partners a seller can assign a shipment to."""
    rows = (await db.execute(
        select(LogisticsProfile).join(User, User.id == LogisticsProfile.user_id)
        .where(LogisticsProfile.is_available.is_(True), User.is_active.is_(True))
        .order_by(LogisticsProfile.company_name)
    )).scalars().all()
    return [{"id": p.id, "company_name": p.company_name, "service_city": p.service_city,
             "vehicle_type": p.vehicle_type} for p in rows]
