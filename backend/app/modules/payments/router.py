from fastapi import APIRouter, Depends, status

from app.core.dependencies import get_current_user
from app.modules.payments.dependencies import get_payment_service
from app.modules.payments.schemas import (
    PaymentCreate, PaymentResponse, TransactionCreate, TransactionResponse,
)
from app.modules.payments.service import PaymentService

router = APIRouter()


@router.post("/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(
    data: PaymentCreate,
    user=Depends(get_current_user),
    service: PaymentService = Depends(get_payment_service),
):
    return await service.create_payment(user.id, user.role, data)


@router.get("/payments/orders/{order_id}", response_model=PaymentResponse)
async def get_payment(
    order_id: int,
    user=Depends(get_current_user),
    service: PaymentService = Depends(get_payment_service),
):
    return await service.get_payment_for_order(user.id, user.role, order_id)


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    data: TransactionCreate,
    user=Depends(get_current_user),
    service: PaymentService = Depends(get_payment_service),
):
    return await service.create_transaction(user.id, user.role, data)


@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: int,
    user=Depends(get_current_user),
    service: PaymentService = Depends(get_payment_service),
):
    return await service.get_transaction(user.id, user.role, transaction_id)