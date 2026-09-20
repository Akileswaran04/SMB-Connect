from typing import List

from fastapi import APIRouter, Depends, status

from app.core.dependencies import get_current_user_id, require_roles
from app.modules.buyer_profile.dependencies import get_buyer_profile_service
from app.modules.buyer_profile.schemas import (
    BuyerProfileUpdate, BuyerProfileResponse,
    AddressCreate, AddressUpdate, AddressResponse,
)
from app.modules.buyer_profile.service import BuyerProfileService

router = APIRouter()


@router.get("/me", response_model=BuyerProfileResponse)
async def get_my_profile(
    user_id: str = Depends(get_current_user_id),
    service: BuyerProfileService = Depends(get_buyer_profile_service),
):
    return await service.get_own_profile(int(user_id))


@router.put("/me", response_model=BuyerProfileResponse)
async def update_my_profile(
    data: BuyerProfileUpdate,
    user_id: str = Depends(get_current_user_id),
    service: BuyerProfileService = Depends(get_buyer_profile_service),
):
    return await service.update_own_profile(int(user_id), data)


@router.get("/me/addresses", response_model=List[AddressResponse])
async def list_my_addresses(
    user_id: str = Depends(get_current_user_id),
    service: BuyerProfileService = Depends(get_buyer_profile_service),
):
    return await service.list_addresses(int(user_id))


@router.post("/me/addresses", response_model=AddressResponse, status_code=status.HTTP_201_CREATED)
async def create_my_address(
    data: AddressCreate,
    user_id: str = Depends(get_current_user_id),
    service: BuyerProfileService = Depends(get_buyer_profile_service),
):
    return await service.create_address(int(user_id), data)


@router.put("/me/addresses/{address_id}", response_model=AddressResponse)
async def update_my_address(
    address_id: int,
    data: AddressUpdate,
    user_id: str = Depends(get_current_user_id),
    service: BuyerProfileService = Depends(get_buyer_profile_service),
):
    return await service.update_address(int(user_id), address_id, data)


@router.delete("/me/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_address(
    address_id: int,
    user_id: str = Depends(get_current_user_id),
    service: BuyerProfileService = Depends(get_buyer_profile_service),
):
    await service.delete_address(int(user_id), address_id)


@router.get("/{buyer_id}", response_model=BuyerProfileResponse)
async def get_buyer(
    buyer_id: int,
    service: BuyerProfileService = Depends(get_buyer_profile_service),
):
    return await service.get_profile(buyer_id)