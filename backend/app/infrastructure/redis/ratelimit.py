import logging
from typing import Optional

from fastapi import HTTPException, Request, status

from app.infrastructure.redis import RedisClient

logger = logging.getLogger(__name__)


class RateLimitExceeded(HTTPException):
    def __init__(self, limit: int, window: int):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded — {limit} requests per {window}s. Try again shortly.",
            headers={"Retry-After": str(window)},
        )


async def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(limit: int, window: int, scope: str):
    async def _check(request: Request) -> None:
        client = await _client_key(request)
        key = f"ratelimit:{scope}:{client}"
        client_redis = await RedisClient.get_client()
        if client_redis is None:
            logger.warning("Rate limiter skipped — Redis unavailable (%s)", key)
            return
        try:
            count = await client_redis.incr(key)
            if count == 1:
                await client_redis.expire(key, window)
            if count > limit:
                raise RateLimitExceeded(limit, window)
        except RateLimitExceeded:
            raise
        except Exception as exc:  # noqa: BLE001 — fail open
            logger.warning("Rate limiter error (%s): %s", key, exc)

    return _check