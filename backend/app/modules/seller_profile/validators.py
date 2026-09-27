
from typing import Optional

from app.shared.enums import SellerProfileStatus
from app.core.exceptions import ValidationException


VALID_TRANSITIONS = {
    SellerProfileStatus.DRAFT: [SellerProfileStatus.SUBMITTED],
    SellerProfileStatus.SUBMITTED: [SellerProfileStatus.UNDER_REVIEW],
    SellerProfileStatus.UNDER_REVIEW: [SellerProfileStatus.VERIFIED, SellerProfileStatus.REJECTED],
    SellerProfileStatus.REJECTED: [SellerProfileStatus.SUBMITTED, SellerProfileStatus.SUSPENDED],
    SellerProfileStatus.VERIFIED: [SellerProfileStatus.SUSPENDED],
    SellerProfileStatus.SUSPENDED: [SellerProfileStatus.UNDER_REVIEW],
}


def validate_status_transition(current_status: str, new_status: str) -> None:
    current = SellerProfileStatus(current_status)
    new = SellerProfileStatus(new_status)

    allowed = VALID_TRANSITIONS.get(current, [])
    if new not in allowed:
        raise ValidationException(
            f"Cannot transition from '{current_status}' to '{new_status}'. "
            f"Allowed transitions: {[s.value for s in allowed]}"
        )


def validate_profile_for_submission(profile_data: dict) -> None:
    required_fields = ["business_name", "business_type", "phone"]
    missing = [f for f in required_fields if not profile_data.get(f)]

    if missing:
        raise ValidationException(
            f"Missing required fields for submission: {', '.join(missing)}"
        )

    if not profile_data.get("license_number"):
        raise ValidationException(
            "License number is required for verification submission"
        )


def validate_business_type(business_type: str) -> None:
    from app.shared.enums import BusinessType
    valid_types = [bt.value for bt in BusinessType]
    if business_type not in valid_types:
        raise ValidationException(
            f"Invalid business type '{business_type}'. "
            f"Allowed: {', '.join(valid_types)}"
        )
