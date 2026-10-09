import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.payments.models import Payment, Transaction
from app.modules.orders.models import Order
from app.modules.payments.schemas import PaymentCreate, TransactionCreate
from app.core.exceptions import NotFoundException, ForbiddenException, ValidationException


class PaymentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _assert_order_access(self, user_id: int, user_role: str, order: Order) -> None:
        from app.modules.buyer_profile.models import BuyerProfile
        from app.modules.seller_profile.models import SellerProfile

        if user_role == "buyer":
            result = await self.db.execute(
                select(BuyerProfile).where(BuyerProfile.user_id == user_id)
            )
            profile = result.scalar_one_or_none()
            if not profile or order.buyer_id != profile.id:
                raise ForbiddenException("Not your order")
        elif user_role == "seller":
            result = await self.db.execute(
                select(SellerProfile).where(SellerProfile.user_id == user_id)
            )
            profile = result.scalar_one_or_none()
            if not profile or order.seller_id != profile.id:
                raise ForbiddenException("Not your order")
        else:
            raise ForbiddenException("Only sellers and buyers can view payments")

    async def _get_order(self, order_id: int) -> Order:
        result = await self.db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundException("Order", str(order_id))
        return order

    async def create_payment(self, user_id: int, user_role: str, data: PaymentCreate) -> dict:
        order = await self._get_order(data.order_id)
        await self._assert_order_access(user_id, user_role, order)

        existing = await self.db.execute(
            select(Payment).where(Payment.order_id == data.order_id)
        )
        if existing.scalar_one_or_none():
            raise ValidationException("Payment already recorded for this order")

        payment = Payment(
            order_id=order.id,
            provider=data.provider or "mock",
            status="completed",
            amount=data.amount if data.amount is not None else order.total_amount,
            reference=f"PAY-{uuid.uuid4().hex[:10].upper()}",
        )
        self.db.add(payment)
        await self.db.flush()
        await self.db.refresh(payment)
        return {
            "id": payment.id,
            "order_id": payment.order_id,
            "provider": payment.provider,
            "status": payment.status,
            "amount": payment.amount,
            "currency": payment.currency,
            "reference": payment.reference,
            "failure_reason": payment.failure_reason,
            "created_at": payment.created_at,
        }

    async def get_payment_for_order(self, user_id: int, user_role: str, order_id: int) -> dict:
        order = await self._get_order(order_id)
        await self._assert_order_access(user_id, user_role, order)
        result = await self.db.execute(
            select(Payment).where(Payment.order_id == order_id)
        )
        payment = result.scalar_one_or_none()
        if not payment:
            raise NotFoundException("Payment", str(order_id))
        return {
            "id": payment.id,
            "order_id": payment.order_id,
            "provider": payment.provider,
            "status": payment.status,
            "amount": payment.amount,
            "currency": payment.currency,
            "reference": payment.reference,
            "failure_reason": payment.failure_reason,
            "created_at": payment.created_at,
        }

    async def create_transaction(self, user_id: int, user_role: str, data: TransactionCreate) -> dict:
        order = await self._get_order(data.order_id)
        await self._assert_order_access(user_id, user_role, order)

        existing = await self.db.execute(
            select(Transaction).where(Transaction.order_id == data.order_id)
        )
        if existing.scalar_one_or_none():
            raise ValidationException("Transaction already recorded for this order")

        transaction = Transaction(
            order_id=order.id,
            amount=data.amount,
            payment_method=data.payment_method or "mock",
            status="completed",
            transaction_id=f"TXN-{uuid.uuid4().hex[:10].upper()}",
        )
        self.db.add(transaction)
        await self.db.flush()
        await self.db.refresh(transaction)
        return self._txn_response(transaction)

    async def get_transaction(self, user_id: int, user_role: str, transaction_id: int) -> dict:
        result = await self.db.execute(
            select(Transaction).where(Transaction.id == transaction_id)
        )
        transaction = result.scalar_one_or_none()
        if not transaction:
            raise NotFoundException("Transaction", str(transaction_id))
        order = await self._get_order(transaction.order_id)
        await self._assert_order_access(user_id, user_role, order)
        return self._txn_response(transaction)

    def _txn_response(self, transaction: Transaction) -> dict:
        return {
            "id": transaction.id,
            "order_id": transaction.order_id,
            "amount": transaction.amount,
            "currency": transaction.currency,
            "status": transaction.status.value if hasattr(transaction.status, "value") else transaction.status,
            "payment_method": transaction.payment_method,
            "transaction_id": transaction.transaction_id,
            "failure_reason": transaction.failure_reason,
            "created_at": transaction.created_at,
            "updated_at": transaction.updated_at,
        }