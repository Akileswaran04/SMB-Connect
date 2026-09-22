
from typing import List

from fastapi import APIRouter, Depends, status

from app.core.dependencies import get_current_user_id
from app.modules.seller_profile.dependencies import get_seller_profile_service
from app.modules.seller_profile.schemas import (
    SellerProfileCreate, SellerProfileUpdate, SellerProfileResponse,
    SellerVerificationResponse, StatusUpdateRequest, ProfileSubmitResponse,
)
from app.modules.seller_profile.service import SellerProfileService

router = APIRouter()


@router.get("/profile", response_model=SellerProfileResponse)
async def get_profile(
    user_id: str = Depends(get_current_user_id),
    service: SellerProfileService = Depends(get_seller_profile_service),
):
    
    profile = await service.get_profile(int(user_id))
    return profile


@router.post("/profile", response_model=SellerProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    data: SellerProfileCreate,
    user_id: str = Depends(get_current_user_id),
    service: SellerProfileService = Depends(get_seller_profile_service),
):
    
    profile = await service.create_profile(int(user_id), data)
    return profile


@router.put("/profile", response_model=SellerProfileResponse)
async def update_profile(
    data: SellerProfileUpdate,
    user_id: str = Depends(get_current_user_id),
    service: SellerProfileService = Depends(get_seller_profile_service),
):
    
    profile = await service.update_profile(int(user_id), data)
    return profile


@router.post("/profile/submit", response_model=ProfileSubmitResponse)
async def submit_profile(
    user_id: str = Depends(get_current_user_id),
    service: SellerProfileService = Depends(get_seller_profile_service),
):
    
    profile = await service.submit_for_review(int(user_id))
    return ProfileSubmitResponse(profile=profile)


@router.patch("/profile/status", response_model=SellerProfileResponse)
async def update_status(
    data: StatusUpdateRequest,
    profile_id: str = None,
    user_id: str = Depends(get_current_user_id),
    service: SellerProfileService = Depends(get_seller_profile_service),
):
    
    target_id = int(profile_id) if profile_id else int(user_id)
    profile = await service.update_status(target_id, data)
    return profile
