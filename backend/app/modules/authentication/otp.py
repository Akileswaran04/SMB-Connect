"""One-time passcodes for login and phone verification (PRD §6, §61).

Codes are stored hashed with a short expiry and a small attempt budget, in
Redis (or process memory if Redis is down, so local development still
works). Delivery goes through the notification channels; in OTP_DEV_MODE the
code is also returned to the caller because no SMS provider is configured.
"""
import hashlib
import hmac
import json
import logging
import secrets
import time
from typing import Optional

from app.core.config import settings
from app.infrastructure.redis import RedisClient

logger = logging.getLogger(__name__)
_memory: dict[str, tuple[float, dict]] = {}


def normalise(identifier: str) -> str:
    ident = identifier.strip().lower()
    return ident if "@" in ident else "".join(ch for ch in ident if ch.isdigit() or ch == "+")


def _hash(code: str, identifier: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), f"{identifier}:{code}".encode(), hashlib.sha256).hexdigest()


async def _store(key: str, value: Optional[dict], ttl: int) -> None:
    client = await RedisClient.get_client()
    if client is not None:
        try:
            if value is None:
                await client.delete(key)
            else:
                await client.set(key, json.dumps(value), ex=ttl)
            return
        except Exception:
            logger.warning("Redis unavailable for OTP; using memory")
    if value is None:
        _memory.pop(key, None)
    else:
        _memory[key] = (time.time() + ttl, value)


async def _load(key: str) -> Optional[dict]:
    client = await RedisClient.get_client()
    if client is not None:
        try:
            raw = await client.get(key)
            return json.loads(raw) if raw else None
        except Exception:
            logger.warning("Redis unavailable for OTP; using memory")
    entry = _memory.get(key)
    if not entry or entry[0] < time.time():
        _memory.pop(key, None)
        return None
    return entry[1]


async def issue(identifier: str, purpose: str = "login") -> str:
    ident = normalise(identifier)
    code = f"{secrets.randbelow(1_000_000):06d}"
    await _store(f"otp:{purpose}:{ident}", {"hash": _hash(code, ident), "attempts": 0}, settings.OTP_TTL_SECONDS)
    return code


async def verify(identifier: str, code: str, purpose: str = "login") -> bool:
    ident = normalise(identifier)
    key = f"otp:{purpose}:{ident}"
    entry = await _load(key)
    if not entry:
        return False
    if entry["attempts"] >= settings.OTP_MAX_ATTEMPTS:
        await _store(key, None, 0)
        return False
    if hmac.compare_digest(entry["hash"], _hash((code or "").strip(), ident)):
        await _store(key, None, 0)
        return True
    entry["attempts"] += 1
    await _store(key, entry, settings.OTP_TTL_SECONDS)
    return False
