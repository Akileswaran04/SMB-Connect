
from typing import AsyncGenerator, Optional, Sequence

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.infrastructure.postgres.session import get_db_session
from app.modules.seller_profile.models import User


async def get_current_user_id(
    authorization: str = Header(None),
) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.replace("Bearer ", "")
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user ID",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_id


def _extract_token(authorization: Optional[str]) -> Optional[dict]:
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "")
    return decode_access_token(token)


def get_token_payload(
    authorization: str = Header(None),
) -> dict:
    payload = _extract_token(authorization)
    if payload is None or payload.get("sub") is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_db_session():
        yield session


async def get_current_user(
    payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
) -> User:
    result = await db.execute(
        select(User).where(User.id == int(payload["sub"]))
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_optional_user(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """The signed-in user, or None for anonymous requests (public pages)."""
    payload = _extract_token(authorization)
    if not payload or payload.get("sub") is None:
        return None
    user = (await db.execute(select(User).where(User.id == int(payload["sub"])))).scalar_one_or_none()
    return user if user and user.is_active else None


def require_roles(*roles: str):
    async def _role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(roles)}",
            )
        return user
    return _role_checker
