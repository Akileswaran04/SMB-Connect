import json
import logging
import time
from typing import Any, Optional

from pydantic import ConfigDict
from pydantic_settings import BaseSettings
from redis.asyncio import Redis

logger = logging.getLogger(__name__)


class RedisSettings(BaseSettings):
    model_config = ConfigDict(env_prefix="redis_", case_sensitive=False)

    url: str = "redis://localhost:6379/0"
    host: str = "localhost"
    port: int = 6379
    db: int = 0


redis_settings = RedisSettings()


class RedisClient:
    client: Optional[Redis] = None
    _last_connect_attempt: float = 0.0
    _CONNECT_RETRY_INTERVAL = 60

    @classmethod
    async def connect_to_redis(cls) -> None:
        cls._last_connect_attempt = time.monotonic()
        try:
            logger.info(f"Connecting to Redis at {redis_settings.host}:{redis_settings.port}...")
            cls.client = await Redis.from_url(
                redis_settings.url,
                encoding="utf8",
                decode_responses=True,
                health_check_interval=30,
                socket_connect_timeout=3,
                socket_timeout=3,
            )
            await cls.client.ping()
            logger.info("Connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {str(e)}")
            cls.client = None

    @classmethod
    async def close_connection(cls) -> None:
        if cls.client is not None:
            await cls.client.close()
            logger.info("Redis connection closed")

    @classmethod
    async def get_client(cls) -> Optional[Redis]:
        if cls.client is None:
            if time.monotonic() - cls._last_connect_attempt < cls._CONNECT_RETRY_INTERVAL:
                return None
            await cls.connect_to_redis()
        return cls.client

    @classmethod
    async def set_cache(
        cls, key: str, value: Any, ttl: int = 3600
    ) -> bool:
        if cls.client is None:
            return False
        try:
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            await cls.client.setex(key, ttl, str(value))
            return True
        except Exception as e:
            logger.error(f"Failed to set cache: {str(e)}")
            return False

    @classmethod
    async def get_cache(cls, key: str) -> Optional[Any]:
        if cls.client is None:
            return None
        try:
            value = await cls.client.get(key)
            if value:
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return value
            return None
        except Exception as e:
            logger.error(f"Failed to get cache: {str(e)}")
            return None

    @classmethod
    async def delete_cache(cls, key: str) -> bool:
        if cls.client is None:
            return False
        try:
            await cls.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Failed to delete cache: {str(e)}")
            return False

    @classmethod
    async def flush_all(cls) -> bool:
        if cls.client is None:
            return False
        try:
            await cls.client.flushdb()
            return True
        except Exception as e:
            logger.error(f"Failed to flush cache: {str(e)}")
            return False


async def get_redis() -> Optional[Redis]:
    return await RedisClient.get_client()
