from typing import Optional


from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.modules.authentication import otp
from app.modules.seller_profile.models import User, SellerProfile
from app.modules.buyer_profile.models import BuyerProfile
from app.modules.logistics.models import LogisticsProfile
from app.modules.authentication.schemas import RegisterRequest, LoginRequest, DemoLoginRequest
from app.modules.notifications.service import _dispatch
from app.core.security import hash_password, verify_password, create_access_token
from app.core.exceptions import ConflictException, ValidationException, NotFoundException, ForbiddenException

DEMO_ACCOUNT_EMAILS = {
    "seller1": "seller1@technova.local",
    "seller2": "seller2@technova.local",
    "seller3": "seller3@technova.local",
    "seller4": "seller4@technova.local",
    "buyer1": "buyer1@technova.local",
    "buyer2": "buyer2@technova.local",
    "buyer3": "buyer3@technova.local",
    "logistics1": "logistics1@technova.local",
    "logistics2": "logistics2@technova.local",
    "admin": "admin@technova.local",
}


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, data: RegisterRequest) -> dict:
        if (await self.db.execute(select(User).where(User.email == data.email))).scalar_one_or_none():
            raise ConflictException("An account with this email already exists")
        if data.phone and (await self.db.execute(select(User).where(User.phone == data.phone))).scalar_one_or_none():
            raise ConflictException("An account with this mobile number already exists")
        if data.role == "logistics" and not (data.company_name or data.full_name):
            raise ValidationException("Company name is required for logistics partners")

        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            full_name=data.full_name,
            phone=data.phone,
            role=data.role,
            is_active=True,
            preferred_language=(data.preferred_language or "en").lower(),
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)

        if data.role == "seller":
            self.db.add(SellerProfile(
                user_id=user.id,
                business_name=data.business_name or data.full_name or "",
                business_type=data.business_type or "other",
                license_number=data.license_number,
                owner_name=data.owner_name or data.full_name,
                phone=data.phone,
                email=data.email,
                city=data.city,
                verification_status="draft",
            ))
        elif data.role == "logistics":
            self.db.add(LogisticsProfile(
                user_id=user.id,
                company_name=data.company_name or data.full_name,
                contact_name=data.full_name,
                phone=data.phone,
                vehicle_type=data.vehicle_type,
                vehicle_number=data.vehicle_number,
                service_city=data.service_city or data.city,
            ))
        else:
            names = (data.full_name or "Buyer").split()
            self.db.add(BuyerProfile(
                user_id=user.id,
                first_name=data.first_name or names[0],
                last_name=data.last_name or (names[-1] if len(names) > 1 else "User"),
                phone=data.phone,
                city=data.city,
                country=data.country or "India",
            ))
        await self.db.flush()
        return await self._token_response(await self._load_user(user.id))

    async def _load_user(self, user_id: int) -> Optional[User]:
        return (await self.db.execute(
            select(User).where(User.id == user_id)
            .options(joinedload(User.seller_profile), joinedload(User.buyer_profile))
        )).scalar_one_or_none()

    async def _find(self, identifier: str) -> Optional[User]:
        ident = identifier.strip()
        return (await self.db.execute(
            select(User).where((User.email == ident.lower()) | (User.email == ident) | (User.phone == ident))
            .options(joinedload(User.seller_profile), joinedload(User.buyer_profile))
        )).scalar_one_or_none()

    @staticmethod
    def _assert_active(user: User) -> None:
        if not user.is_active:
            raise ForbiddenException("This account is suspended. Contact support.")

    async def demo_login(self, data: DemoLoginRequest) -> dict:
        email = DEMO_ACCOUNT_EMAILS.get(data.demo)
        if not email:
            raise ValidationException("Unknown demo account")
        user = await self._find(email)
        if not user:
            raise NotFoundException("User", email)
        self._assert_active(user)
        return await self._token_response(user)

    async def login(self, data: LoginRequest) -> dict:
        user = await self._find(data.identifier)
        if not user:
            raise NotFoundException("User", data.identifier)
        if not verify_password(data.password, user.password_hash):
            raise ValidationException("Incorrect password")
        self._assert_active(user)
        return await self._token_response(user)

    async def request_otp(self, identifier: str) -> dict:
        """Send a login code. The response doesn't say whether the account
        exists, except in dev mode where the code itself is returned."""
        user = await self._find(identifier)
        channel = "email" if "@" in identifier else "sms"
        response = {"sent": True, "channel": channel, "expires_in": settings.OTP_TTL_SECONDS}
        if user and user.is_active:
            code = await otp.issue(identifier)
            await _dispatch(channel, user, "Your SMBConnect login code", f"Your code is {code}")
            if settings.OTP_DEV_MODE:
                response["dev_code"] = code
        return response

    async def verify_otp(self, identifier: str, code: str) -> dict:
        if not await otp.verify(identifier, code):
            raise ValidationException("That code is incorrect or has expired")
        user = await self._find(identifier)
        if not user:
            raise NotFoundException("User", identifier)
        self._assert_active(user)
        if not user.is_verified:
            user.is_verified = True  # proving control of the email/phone verifies it
            await self.db.flush()
        return await self._token_response(user)

    async def _token_response(self, user) -> dict:
        role = user.role.value if hasattr(user.role, "value") else user.role
        seller_id = buyer_id = logistics_id = None
        if role == "seller" and user.seller_profile:
            seller_id = str(user.seller_profile.id)
        elif role == "buyer" and user.buyer_profile:
            buyer_id = str(user.buyer_profile.id)
        elif role == "logistics":
            lp = (await self.db.execute(select(LogisticsProfile.id).where(LogisticsProfile.user_id == user.id))).scalar_one_or_none()
            logistics_id = str(lp) if lp else None
        token = create_access_token(data={"sub": str(user.id), "role": role})
        return {
            "access_token": token,
            "token_type": "bearer",
            "role": role,
            "seller_id": seller_id,
            "buyer_id": buyer_id,
            "logistics_id": logistics_id,
            "email": user.email,
            "full_name": user.full_name,
            "preferred_language": user.preferred_language,
        }

    async def get_current_user(self, user_id) -> Optional[User]:
        return await self._load_user(user_id)

    async def update_language(self, user_id: int, preferred_language: str) -> None:
        await self.db.execute(
            update(User).where(User.id == user_id).values(preferred_language=preferred_language)
        )
        await self.db.flush()

    async def get_seller_profile(self, user_id) -> Optional[SellerProfile]:
        return (await self.db.execute(select(SellerProfile).where(SellerProfile.user_id == user_id))).scalar_one_or_none()

    async def get_buyer_profile(self, user_id) -> Optional[BuyerProfile]:
        return (await self.db.execute(select(BuyerProfile).where(BuyerProfile.user_id == user_id))).scalar_one_or_none()
