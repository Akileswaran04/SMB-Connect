"""Platform settings — admin-editable values with safe defaults, so the
platform works before an admin has saved anything."""
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationException
from app.modules.platform.models import PlatformSetting

DEFAULTS: dict = {
    "platform_fee_pct": 2.0,          # deducted from the seller's settlement
    "standard_delivery_fee": 40.0,
    "express_delivery_fee": 99.0,
    "free_delivery_threshold": 499.0,
    "cod_enabled": True,
    "cod_max_amount": 10000.0,
    "reorder_reminder_days": 25,
}

_NUMERIC_KEYS = {"platform_fee_pct", "standard_delivery_fee", "express_delivery_fee",
                 "free_delivery_threshold", "cod_max_amount", "reorder_reminder_days"}


class PlatformSettingsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self) -> dict:
        rows = (await self.db.execute(select(PlatformSetting))).scalars().all()
        values = dict(DEFAULTS)
        values.update({r.key: r.value for r in rows if r.key in DEFAULTS})
        return values

    async def get(self, key: str):
        return (await self.get_all())[key]

    async def update(self, changes: dict) -> dict:
        for key, value in changes.items():
            if key not in DEFAULTS:
                raise ValidationException(f"Unknown setting '{key}'")
            if key in _NUMERIC_KEYS:
                try:
                    value = float(value)
                except (TypeError, ValueError):
                    raise ValidationException(f"'{key}' must be a number")
                if value < 0 or (key == "platform_fee_pct" and value > 50):
                    raise ValidationException(f"'{key}' is out of range")
            else:
                value = bool(value)
            row = await self.db.get(PlatformSetting, key)
            if row:
                row.value = value
                row.updated_at = datetime.utcnow()
            else:
                self.db.add(PlatformSetting(key=key, value=value))
        await self.db.flush()
        return await self.get_all()
