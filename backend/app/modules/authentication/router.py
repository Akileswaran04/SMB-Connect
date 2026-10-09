from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user_id
from app.infrastructure.redis.ratelimit import rate_limit
from app.modules.authentication.dependencies import get_auth_service
from app.modules.authentication.schemas import (
    RegisterRequest, LoginRequest, DemoLoginRequest, TokenResponse, LanguageUpdate, OtpRequest, OtpVerify,
)
from app.modules.authentication.service import AuthService

router = APIRouter()


@router.post(
    "/register",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit(20, 60, "auth:register"))],
)
async def register(
    data: RegisterRequest,
    service: AuthService = Depends(get_auth_service),
):
    return await service.register(data)


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit(30, 60, "auth:login"))],
)
async def login(
    data: LoginRequest,
    service: AuthService = Depends(get_auth_service),
):
    return await service.login(data)


@router.post("/otp/request", dependencies=[Depends(rate_limit(5, 60, "auth:otp-request"))])
async def request_otp(data: OtpRequest, service: AuthService = Depends(get_auth_service)):
    """Send a one-time login code to an email or mobile number."""
    return await service.request_otp(data.identifier)


@router.post(
    "/otp/verify",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit(10, 60, "auth:otp-verify"))],
)
async def verify_otp(data: OtpVerify, service: AuthService = Depends(get_auth_service)):
    """Log in with a one-time code (also verifies the email/phone)."""
    return await service.verify_otp(data.identifier, data.code)


@router.post(
    "/demo-login",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit(30, 60, "auth:demo"))],
)
async def demo_login(
    data: DemoLoginRequest,
    service: AuthService = Depends(get_auth_service),
):
    return await service.demo_login(data)


@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(
    user_id: str = Depends(get_current_user_id),
    service: AuthService = Depends(get_auth_service),
):
    uid = int(user_id)
    user = await service.get_current_user(uid)
    role = user.role.value if hasattr(user.role, "value") else user.role

    base = {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "role": role,
            "preferred_language": user.preferred_language,
            "is_verified": user.is_verified,
        } if user else None,
        "seller": None,
        "buyer": None,
        "logistics": None,
    }

    if role == "seller":
        profile = user.seller_profile
        base["seller"] = {
            "id": str(profile.id),
            "business_name": profile.business_name,
            "business_type": profile.business_type,
            "description": profile.description,
            "phone": profile.phone,
            "email": profile.email,
            "website": profile.website,
            "city": profile.city,
            "country": profile.country,
            "verification_status": profile.verification_status.value if hasattr(profile.verification_status, "value") else profile.verification_status,
            "address_line_1": profile.address_line_1,
            "state": profile.state,
            "postal_code": profile.postal_code,
            "license_number": profile.license_number,
            "owner_name": profile.owner_name,
            "bank_account_holder": profile.bank_account_holder,
            "bank_account_last4": profile.bank_account_last4,
            "bank_ifsc": profile.bank_ifsc,
            "upi_id": profile.upi_id,
            "avatar_image": profile.avatar_image,
            "cover_image": profile.cover_image,
            "documents": profile.documents or [],
            "created_at": profile.created_at.isoformat() if profile.created_at else None,
        } if profile else None
    elif role == "logistics":
        from sqlalchemy import select
        from app.modules.logistics.models import LogisticsProfile
        lp = (await service.db.execute(select(LogisticsProfile).where(LogisticsProfile.user_id == uid))).scalar_one_or_none()
        base["logistics"] = {
            "id": str(lp.id), "company_name": lp.company_name, "contact_name": lp.contact_name, "phone": lp.phone,
            "vehicle_type": lp.vehicle_type, "vehicle_number": lp.vehicle_number, "service_city": lp.service_city,
            "is_available": lp.is_available,
        } if lp else None
    elif role == "buyer":
        profile = user.buyer_profile
        base["buyer"] = {
            "id": str(profile.id),
            "first_name": profile.first_name,
            "last_name": profile.last_name,
            "phone": profile.phone,
            "city": profile.city,
            "country": profile.country,
            "created_at": profile.created_at.isoformat() if profile.created_at else None,
        } if profile else None

    return base


@router.patch("/me/language")
async def update_my_language(
    data: LanguageUpdate,
    user_id: str = Depends(get_current_user_id),
    service: AuthService = Depends(get_auth_service),
):
    await service.update_language(int(user_id), data.preferred_language)
    return {"preferred_language": data.preferred_language}