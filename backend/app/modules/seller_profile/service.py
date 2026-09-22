
from typing import Optional


from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.seller_profile.repository import SellerProfileRepository, SellerVerificationRepository
from app.modules.seller_profile.validators import (
    validate_status_transition,
    validate_profile_for_submission,
    validate_business_type,
)
from app.modules.seller_profile.schemas import (
    SellerProfileCreate, SellerProfileUpdate, StatusUpdateRequest,
)
from app.shared.enums import SellerProfileStatus
from app.core.exceptions import NotFoundException, ConflictException


class SellerProfileService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.profile_repo = SellerProfileRepository(db)
        self.verification_repo = SellerVerificationRepository(db)

    async def create_profile(self, user_id: int, data: SellerProfileCreate) -> dict:
        existing = await self.profile_repo.get_by_user_id(user_id)
        if existing:
            raise ConflictException("Seller profile already exists for this user")

        validate_business_type(data.business_type)

        profile = await self.profile_repo.create(
            user_id=user_id,
            data=data.model_dump(exclude_unset=True),
        )

        return profile

    async def get_profile(self, user_id: int) -> dict:
        profile = await self.profile_repo.get_by_user_id(user_id)
        if not profile:
            raise NotFoundException("SellerProfile", str(user_id))
        return profile

    async def get_profile_by_id(self, profile_id: int) -> dict:
        profile = await self.profile_repo.get_by_id(profile_id)
        if not profile:
            raise NotFoundException("SellerProfile", str(profile_id))
        return profile

    async def update_profile(self, user_id: int, data: SellerProfileUpdate) -> dict:
        profile = await self.profile_repo.get_by_user_id(user_id)
        if not profile:
            raise NotFoundException("SellerProfile", str(user_id))

        if profile.verification_status not in [
            SellerProfileStatus.DRAFT, SellerProfileStatus.REJECTED
        ]:
            from app.core.exceptions import ValidationException
            raise ValidationException(
                "Cannot update profile while it is under review or verified. "
                "Submit a new profile after rejection."
            )

        update_data = data.model_dump(exclude_unset=True)
        if "business_type" in update_data:
            validate_business_type(update_data["business_type"])

        updated = await self.profile_repo.update(profile.id, update_data)
        return updated

    async def submit_for_review(self, user_id: int) -> dict:
        profile = await self.profile_repo.get_by_user_id(user_id)
        if not profile:
            raise NotFoundException("SellerProfile", str(user_id))

        profile_data = {
            "business_name": profile.business_name,
            "business_type": profile.business_type,
            "phone": profile.phone,
            "license_number": profile.license_number,
        }
        validate_profile_for_submission(profile_data)

        validate_status_transition(
            profile.verification_status,
            SellerProfileStatus.SUBMITTED.value,
        )

        updated = await self.profile_repo.update_status(
            profile.id, SellerProfileStatus.SUBMITTED.value
        )

        await self.verification_repo.create(
            seller_id=profile.id,
            data={
                "verification_type": "business_license",
                "document_reference": profile.license_number,
                "status": "pending",
            },
        )

        return updated

    async def update_status(self, profile_id: int, status_update: StatusUpdateRequest) -> dict:
        profile = await self.profile_repo.get_by_id(profile_id)
        if not profile:
            raise NotFoundException("SellerProfile", str(profile_id))

        validate_status_transition(
            profile.verification_status,
            status_update.status.value,
        )

        updated = await self.profile_repo.update_status(
            profile.id, status_update.status.value
        )

        if status_update.status == SellerProfileStatus.REJECTED and status_update.rejection_reason:
            await self.verification_repo.create(
                seller_id=profile.id,
                data={
                    "verification_type": "profile_review",
                    "status": "rejected",
                    "rejection_reason": status_update.rejection_reason,
                },
            )

        return updated
