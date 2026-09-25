from typing import Optional


from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.seller_profile.models import User, SellerProfile
from app.modules.buyer_profile.models import BuyerProfile
from app.modules.authentication.schemas import RegisterRequest, LoginRequest, DemoLoginRequest
from app.core.security import hash_password, verify_password, create_access_token
from app.core.exceptions import ConflictException, ValidationException, NotFoundException

DEMO_ACCOUNT_EMAILS = {
    "seller1": "seller1@technova.local",
    "seller2": "seller2@technova.local",
    "seller3": "seller3@technova.local",
    "buyer1": "buyer1@technova.local",
    "buyer2": "buyer2@technova.local",
    "buyer3": "buyer3@technova.local",
    "admin": "admin@technova.local",
}


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, data: RegisterRequest) -> dict:
        existing = await self.db.execute(
            select(User).where(User.email == data.email)
        )
        if existing.scalar_one_or_none():
            raise ConflictException("An account with this email already exists")

        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            full_name=data.full_name,
            phone=data.phone,
            role=data.role,
            is_active=True,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)

        seller_id = None
        buyer_id = None

        if data.role == "seller":
            profile = SellerProfile(
                user_id=user.id,
                business_name=data.business_name or data.full_name or "",
                business_type=data.business_type or "other",
                license_number=data.license_number,
                verification_status="draft",
            )
            self.db.add(profile)
            await self.db.flush()
            await self.db.refresh(profile)
            seller_id = str(profile.id)
        else:
            profile = BuyerProfile(
                user_id=user.id,
                first_name=data.first_name or (data.full_name or "Buyer").split()[0],
                last_name=data.last_name or (data.full_name or "Buyer").split()[-1] if (data.full_name or "Buyer").split() else "User",
                phone=data.phone,
                city=data.city,
                country=data.country or "India",
            )
            self.db.add(profile)
            await self.db.flush()
            await self.db.refresh(profile)
            buyer_id = str(profile.id)

        token = create_access_token(data={"sub": str(user.id), "role": user.role})

        return {
            "access_token": token,
            "token_type": "bearer",
            "role": user.role,
            "seller_id": seller_id,
            "buyer_id": buyer_id,
            "email": user.email,
            "full_name": user.full_name,
        }

    async def demo_login(self, data: DemoLoginRequest) -> dict:
        email = DEMO_ACCOUNT_EMAILS.get(data.demo)
        if not email:
            raise ValidationException("Unknown demo account")
        result = await self.db.execute(
            select(User)
            .where(User.email == email)
            .options(joinedload(User.seller_profile), joinedload(User.buyer_profile))
        )
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise NotFoundException("User", email)
        return await self._token_response(user)

    async def login(self, data: LoginRequest) -> dict:
        result = await self.db.execute(
            select(User)
            .where(
                (User.email == data.identifier) | (User.phone == data.identifier)
            )
            .options(joinedload(User.seller_profile), joinedload(User.buyer_profile))
        )
        user = result.scalar_one_or_none()

        if not user:
            raise NotFoundException("User", data.identifier)

        if not verify_password(data.password, user.password_hash):
            raise ValidationException("Incorrect password")

        seller_id = None
        buyer_id = None
        if user.role == "seller":
            profile = user.seller_profile
            seller_id = str(profile.id) if profile else None
        elif user.role == "buyer":
            profile = user.buyer_profile
            buyer_id = str(profile.id) if profile else None

        return await self._token_response(user, seller_id=seller_id, buyer_id=buyer_id)

    async def _token_response(self, user, seller_id=None, buyer_id=None) -> dict:
        if user.role == "seller" and seller_id is None:
            profile = user.seller_profile
            seller_id = str(profile.id) if profile else None
        elif user.role == "buyer" and buyer_id is None:
            profile = user.buyer_profile
            buyer_id = str(profile.id) if profile else None

        token = create_access_token(data={"sub": str(user.id), "role": user.role})

        return {
            "access_token": token,
            "token_type": "bearer",
            "role": user.role,
            "seller_id": seller_id,
            "buyer_id": buyer_id,
            "email": user.email,
            "full_name": user.full_name,
        }

    async def get_current_user(self, user_id) -> Optional[User]:
        result = await self.db.execute(
            select(User)
            .where(User.id == user_id)
            .options(joinedload(User.seller_profile), joinedload(User.buyer_profile))
        )
        return result.scalar_one_or_none()

    async def update_language(self, user_id: int, preferred_language: str) -> None:
        await self.db.execute(
            update(User).where(User.id == user_id).values(preferred_language=preferred_language)
        )
        await self.db.flush()

    async def get_seller_profile(self, user_id) -> Optional[SellerProfile]:
        result = await self.db.execute(
            select(SellerProfile).where(SellerProfile.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_buyer_profile(self, user_id) -> Optional[BuyerProfile]:
        result = await self.db.execute(
            select(BuyerProfile).where(BuyerProfile.user_id == user_id)
        )
        return result.scalar_one_or_none()