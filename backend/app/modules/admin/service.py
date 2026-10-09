"""Admin Service — platform dashboard, users, seller verification, product
moderation, categories, order inspection, analytics, settings, settlements
(PRD §46–51). Every change an admin makes is written to the audit log."""
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, cast, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, ValidationException, ForbiddenException
from app.infrastructure.mongodb.chat import get_conversations_collection, get_messages_collection
from app.modules.admin.models import AuditLog
from app.modules.admin.schemas import VerificationDecision
from app.modules.buyer_profile.models import BuyerProfile
from app.modules.catalogue.models import Category, ProductReport
from app.modules.disputes.models import Dispute
from app.modules.logistics.models import LogisticsProfile
from app.modules.negotiation.models import NegotiationOffer
from app.modules.notifications.service import NotificationService
from app.modules.orders.models import Order, OrderItem, Review
from app.modules.orders.service import OrderService
from app.modules.payments.models import Payment
from app.modules.seller_profile.models import (
    SellerVerification, SellerProfile, Product, User, verificationstatus_enum,
)
from app.modules.shipments.models import Shipment, ShipmentEvent


def _v(value):
    return value.value if hasattr(value, "value") else value


class AdminService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.notifications = NotificationService(db)

    def _audit(self, admin_id: int, action: str, resource_type: str, resource_id: Optional[int], changes: str,
               status: str = "success") -> None:
        self.db.add(AuditLog(user_id=admin_id, action=action, resource_type=resource_type,
                             resource_id=resource_id, changes=changes, status=status))

    # ── Dashboard (§47) ──

    async def dashboard(self) -> dict:
        role_counts = dict((await self.db.execute(select(User.role, func.count(User.id)).group_by(User.role))).all())
        role_counts = {_v(k): v for k, v in role_counts.items()}
        active_sellers = (await self.db.execute(
            select(func.count(func.distinct(SellerProfile.id)))
            .join(Product, Product.seller_id == SellerProfile.id)
            .join(User, User.id == SellerProfile.user_id)
            .where(SellerProfile.verification_status == "verified", Product.status == "published", User.is_active.is_(True))
        )).scalar() or 0
        orders_total = (await self.db.execute(select(func.count(Order.id)))).scalar() or 0
        revenue = (await self.db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.status == "completed")
        )).scalar() or 0.0
        platform_fees = (await self.db.execute(
            select(func.coalesce(func.sum(Order.platform_fee), 0)).where(Order.status.notin_(("cancelled", "refunded")))
        )).scalar() or 0.0
        active_shipments = (await self.db.execute(
            select(func.count(Shipment.id)).where(Shipment.status.notin_(("delivered", "returned_to_seller")))
        )).scalar() or 0
        pending_verification = (await self.db.execute(
            select(func.count(SellerProfile.id)).where(SellerProfile.verification_status.in_(("submitted", "under_review")))
        )).scalar() or 0
        pending_docs = (await self.db.execute(
            select(func.count(SellerVerification.id)).where(SellerVerification.status == cast("pending", verificationstatus_enum))
        )).scalar() or 0
        open_disputes = (await self.db.execute(
            select(func.count(Dispute.id)).where(Dispute.status.in_(("open", "under_review")))
        )).scalar() or 0
        return {
            "total_buyers": role_counts.get("buyer", 0),
            "total_sellers": role_counts.get("seller", 0),
            "total_logistics": role_counts.get("logistics", 0),
            "active_sellers": active_sellers,
            "orders": orders_total,
            "revenue": round(float(revenue), 2),
            "platform_fees": round(float(platform_fees), 2),
            "active_shipments": active_shipments,
            "pending_verification": max(pending_verification, pending_docs),
            "disputes": open_disputes,
            "alerts": await self._alerts(),
        }

    async def _alerts(self) -> list[dict]:
        now = datetime.utcnow()
        alerts = []
        late = (await self.db.execute(select(func.count(Shipment.id)).where(
            Shipment.status.notin_(("delivered", "returned_to_seller")), Shipment.expected_delivery_at < now,
        ))).scalar() or 0
        if late:
            alerts.append({"level": "warning", "message": f"{late} shipment(s) past their expected delivery date"})
        failed = (await self.db.execute(select(func.count(Shipment.id)).where(Shipment.status == "delivery_failed"))).scalar() or 0
        if failed:
            alerts.append({"level": "warning", "message": f"{failed} failed delivery attempt(s) awaiting retry"})
        unassigned = (await self.db.execute(select(func.count(Shipment.id)).where(Shipment.status == "created"))).scalar() or 0
        if unassigned:
            alerts.append({"level": "error", "message": f"{unassigned} shipment(s) have no logistics partner"})
        reports = (await self.db.execute(select(func.count(ProductReport.id)).where(ProductReport.status == "open"))).scalar() or 0
        if reports:
            alerts.append({"level": "info", "message": f"{reports} reported product(s) to review"})
        stuck = (await self.db.execute(select(func.count(Order.id)).where(
            Order.status.in_(("paid", "payment_pending")), Order.created_at < now - timedelta(days=2),
        ))).scalar() or 0
        if stuck:
            alerts.append({"level": "warning", "message": f"{stuck} order(s) not confirmed by the seller within 2 days"})
        return alerts

    # ── Users (§48) ──

    async def list_users(self, role: Optional[str] = None, q: Optional[str] = None, limit: int = 100) -> list:
        query = select(User)
        if role:
            query = query.where(User.role == role)
        if q:
            like = f"%{q}%"
            query = query.where(or_(User.email.ilike(like), User.full_name.ilike(like), User.phone.ilike(like)))
        users = (await self.db.execute(query.order_by(User.id.desc()).limit(limit))).scalars().all()
        return [{"id": u.id, "email": u.email, "phone": u.phone, "full_name": u.full_name, "role": _v(u.role),
                 "is_active": u.is_active, "is_verified": u.is_verified, "preferred_language": u.preferred_language,
                 "created_at": u.created_at} for u in users]

    async def update_user(self, admin, user_id: int, changes: dict) -> dict:
        user = await self.db.get(User, user_id)
        if not user:
            raise NotFoundException("User", str(user_id))
        if user.id == admin.id and (changes.get("is_active") is False or changes.get("role") not in (None, "admin")):
            raise ForbiddenException("You can't suspend or demote yourself")
        new_role = changes.get("role")
        if new_role and new_role != _v(user.role):
            # A role change without the matching profile would leave the account unusable.
            has_profile = {
                "seller": SellerProfile, "buyer": BuyerProfile, "logistics": LogisticsProfile,
            }.get(new_role)
            if has_profile is not None and not (await self.db.execute(
                select(has_profile.id).where(has_profile.user_id == user.id)
            )).scalar_one_or_none():
                raise ValidationException(f"This user has no {new_role} profile, so the role can't be switched")
            user.role = new_role
        for key in ("is_active", "is_verified"):
            if changes.get(key) is not None:
                setattr(user, key, changes[key])
        user.updated_at = datetime.utcnow()
        self._audit(admin.id, "user.update", "user", user.id, str({k: v for k, v in changes.items() if v is not None}))
        await self.db.flush()
        return (await self.list_users(q=user.email, limit=1))[0]

    # ── Seller verification (§49) ──

    async def list_sellers(self, status: Optional[str] = None) -> list:
        query = select(SellerProfile, User.email, User.is_active).join(User, User.id == SellerProfile.user_id)
        if status:
            query = query.where(SellerProfile.verification_status == status)
        rows = (await self.db.execute(query.order_by(SellerProfile.id.desc()))).all()
        return [{"id": s.id, "user_id": s.user_id, "business_name": s.business_name, "owner_name": s.owner_name,
                 "business_type": s.business_type, "city": s.city, "email": email, "phone": s.phone,
                 "license_number": s.license_number, "verification_status": _v(s.verification_status),
                 "is_active": active, "created_at": s.created_at} for s, email, active in rows]

    async def get_seller(self, seller_id: int) -> dict:
        seller = await self.db.get(SellerProfile, seller_id)
        if not seller:
            raise NotFoundException("Seller", str(seller_id))
        docs = (await self.db.execute(
            select(SellerVerification).where(SellerVerification.seller_id == seller_id).order_by(SellerVerification.id.desc())
        )).scalars().all()
        products = (await self.db.execute(select(func.count(Product.id)).where(Product.seller_id == seller_id))).scalar()
        orders = (await self.db.execute(select(func.count(Order.id)).where(Order.seller_id == seller_id))).scalar()
        return {
            "id": seller.id, "business_name": seller.business_name, "owner_name": seller.owner_name,
            "business_type": seller.business_type, "description": seller.description,
            "phone": seller.phone, "email": seller.email,
            "address": ", ".join(p for p in [seller.address_line_1, seller.address_line_2, seller.city,
                                             seller.state, seller.postal_code] if p),
            "license_number": seller.license_number,
            "bank": {"holder": seller.bank_account_holder, "account_last4": seller.bank_account_last4,
                     "ifsc": seller.bank_ifsc, "upi_id": seller.upi_id},
            "verification_status": _v(seller.verification_status),
            "documents": [{"id": d.id, "type": _v(d.verification_type), "reference": d.document_reference,
                           "status": _v(d.status), "reason": d.rejection_reason, "admin_note": d.admin_note,
                           "submitted_at": d.created_at, "reviewed_at": d.reviewed_at} for d in docs],
            "product_count": products, "order_count": orders,
        }

    async def decide_seller(self, admin, seller_id: int, decision: str, note: Optional[str]) -> dict:
        """APPROVE / REJECT / REQUEST INFORMATION for a seller as a whole."""
        seller = await self.db.get(SellerProfile, seller_id)
        if not seller:
            raise NotFoundException("Seller", str(seller_id))
        if decision == "reject" and not note:
            raise ValidationException("Give the seller a reason for the rejection")
        if decision == "request_info" and not note:
            raise ValidationException("Say what information is needed")
        doc_status = {"approve": "approved", "reject": "rejected", "request_info": "info_requested"}[decision]
        # Requesting information sends the profile back to draft so the seller
        # can edit it and resubmit.
        seller.verification_status = {"approve": "verified", "reject": "rejected", "request_info": "draft"}[decision]
        now = datetime.now(timezone.utc)
        for doc in (await self.db.execute(
            select(SellerVerification).where(SellerVerification.seller_id == seller_id,
                                             SellerVerification.status == cast("pending", verificationstatus_enum))
        )).scalars().all():
            doc.status = doc_status
            doc.reviewed_by = admin.id
            doc.reviewed_at = now
            doc.rejection_reason = note if decision == "reject" else None
            doc.admin_note = note
        self._audit(admin.id, f"seller.{decision}", "seller_profile", seller.id, note or decision)
        title = {"approve": "Your store is verified", "reject": "Verification rejected",
                 "request_info": "More information needed"}[decision]
        await self.notifications.notify(seller.user_id, "seller_verification", title, note or title,
                                        {"decision": decision})
        await self.db.flush()
        return await self.get_seller(seller_id)

    async def list_verifications(self, status: Optional[str] = None, limit: int = 100, offset: int = 0) -> list:
        query = select(SellerVerification, SellerProfile.business_name).join(
            SellerProfile, SellerVerification.seller_id == SellerProfile.id)
        if status:
            query = query.where(SellerVerification.status == cast(status, verificationstatus_enum))
        rows = (await self.db.execute(
            query.order_by(SellerVerification.created_at.desc()).limit(limit).offset(offset)
        )).all()
        return [{"id": v.id, "seller_id": v.seller_id, "business_name": name,
                 "verification_type": _v(v.verification_type), "document_reference": v.document_reference,
                 "status": _v(v.status), "submitted_at": v.created_at} for v, name in rows]

    async def review_verification(self, admin_user_id: int, verification_id: int, data: VerificationDecision) -> dict:
        verification = await self.db.get(SellerVerification, verification_id)
        if not verification:
            raise NotFoundException("SellerVerification", str(verification_id))
        if _v(verification.status) not in ("pending", "info_requested"):
            raise ValidationException("Verification already reviewed")
        verification.status = data.decision
        verification.reviewed_by = int(admin_user_id)
        verification.reviewed_at = datetime.now(timezone.utc)
        verification.rejection_reason = data.reason if data.decision == "rejected" else None
        verification.admin_note = data.reason
        seller = await self.db.get(SellerProfile, verification.seller_id)
        if seller:
            seller.verification_status = {"approved": "verified", "rejected": "rejected",
                                          "info_requested": "draft"}[data.decision]
            await self.notifications.notify(seller.user_id, "seller_verification",
                                            f"Verification {data.decision.replace('_', ' ')}",
                                            data.reason or "Your document was reviewed.", {})
        self._audit(admin_user_id, f"verification.{data.decision}", "seller_verification", verification_id,
                    data.reason or f"Verification {data.decision}", data.decision)
        await self.db.flush()
        return {"id": verification.id, "seller_id": verification.seller_id, "decision": data.decision,
                "reason": data.reason, "seller_verification_status": _v(seller.verification_status) if seller else None}

    # ── Products & categories (§50) ──

    async def list_products(self, status: Optional[str] = None, reported: bool = False, q: Optional[str] = None) -> list:
        open_reports = (
            select(ProductReport.product_id, func.count(ProductReport.id).label("n"))
            .where(ProductReport.status == "open").group_by(ProductReport.product_id).subquery()
        )
        query = (
            select(Product, SellerProfile.business_name, func.coalesce(open_reports.c.n, 0))
            .join(SellerProfile, SellerProfile.id == Product.seller_id)
            .outerjoin(open_reports, open_reports.c.product_id == Product.id)
        )
        if status:
            query = query.where(Product.status == status)
        if reported:
            query = query.where(open_reports.c.n > 0)
        if q:
            query = query.where(Product.name.ilike(f"%{q}%"))
        rows = (await self.db.execute(query.order_by(Product.id.desc()).limit(300))).all()
        return [{"id": p.id, "name": p.name, "category": p.category, "price": p.price, "stock": p.stock,
                 "status": _v(p.status), "seller_id": p.seller_id, "seller_name": seller, "open_reports": n,
                 "image_url": p.image_url, "created_at": p.created_at} for p, seller, n in rows]

    async def moderate_product(self, admin, product_id: int, status: str, note: Optional[str]) -> dict:
        product = await self.db.get(Product, product_id)
        if not product:
            raise NotFoundException("Product", str(product_id))
        product.status = status
        product.updated_at = datetime.utcnow()
        if status == "deleted":
            for report in (await self.db.execute(
                select(ProductReport).where(ProductReport.product_id == product_id, ProductReport.status == "open")
            )).scalars().all():
                report.status, report.resolution_note, report.resolved_at = "resolved", note, datetime.utcnow()
            seller_user = (await self.db.execute(
                select(SellerProfile.user_id).where(SellerProfile.id == product.seller_id)
            )).scalar_one_or_none()
            await self.notifications.notify(seller_user, "product_removed", "Product removed",
                                            f"'{product.name}' was removed by moderation. {note or ''}".strip(),
                                            {"product_id": product.id})
        self._audit(admin.id, f"product.{status}", "product", product.id, note or status)
        await self.db.flush()
        return {"id": product.id, "status": _v(product.status)}

    async def list_reports(self, status: Optional[str] = "open") -> list:
        query = select(ProductReport, Product.name).join(Product, Product.id == ProductReport.product_id)
        if status:
            query = query.where(ProductReport.status == status)
        rows = (await self.db.execute(query.order_by(ProductReport.id.desc()).limit(300))).all()
        return [{"id": r.id, "product_id": r.product_id, "product_name": name, "reason": r.reason,
                 "status": r.status, "resolution_note": r.resolution_note, "created_at": r.created_at}
                for r, name in rows]

    async def resolve_report(self, admin, report_id: int, status: str, note: Optional[str], remove_product: bool) -> dict:
        report = await self.db.get(ProductReport, report_id)
        if not report:
            raise NotFoundException("ProductReport", str(report_id))
        if remove_product:
            await self.moderate_product(admin, report.product_id, "deleted", note)
        report.status, report.resolution_note, report.resolved_at = status, note, datetime.utcnow()
        self._audit(admin.id, f"report.{status}", "product_report", report.id, note or status)
        await self.db.flush()
        return {"id": report.id, "status": report.status}

    async def list_categories(self, active_only: bool = False) -> list:
        query = select(Category)
        if active_only:
            query = query.where(Category.is_active.is_(True))
        rows = (await self.db.execute(query.order_by(Category.sort_order, Category.name))).scalars().all()
        counts = dict((await self.db.execute(
            select(Product.category, func.count(Product.id)).where(Product.status == "published").group_by(Product.category)
        )).all())
        return [{"id": c.id, "name": c.name, "icon": c.icon, "sort_order": c.sort_order, "is_active": c.is_active,
                 "product_count": counts.get(c.name, 0)} for c in rows]

    async def save_category(self, admin, category_id: Optional[int], data: dict) -> dict:
        if category_id is None:
            if (await self.db.execute(select(Category.id).where(func.lower(Category.name) == data["name"].lower()))).scalar_one_or_none():
                raise ValidationException("A category with that name already exists")
            category = Category(**data)
            self.db.add(category)
        else:
            category = await self.db.get(Category, category_id)
            if not category:
                raise NotFoundException("Category", str(category_id))
            for key, value in data.items():
                if value is not None:
                    setattr(category, key, value)
        await self.db.flush()
        self._audit(admin.id, "category.save", "category", category.id, str(data))
        return {"id": category.id, "name": category.name, "icon": category.icon,
                "sort_order": category.sort_order, "is_active": category.is_active}

    async def delete_category(self, admin, category_id: int) -> None:
        category = await self.db.get(Category, category_id)
        if not category:
            raise NotFoundException("Category", str(category_id))
        in_use = (await self.db.execute(select(func.count(Product.id)).where(Product.category == category.name))).scalar()
        if in_use:
            category.is_active = False  # keep products categorised; just hide it from pickers
        else:
            await self.db.delete(category)
        self._audit(admin.id, "category.delete", "category", category_id, category.name)
        await self.db.flush()

    # ── Orders (§51) ──

    async def inspect_order(self, admin, order_id: int) -> dict:
        orders = OrderService(self.db)
        detail = await orders.get_order_for(admin, order_id)
        order = await orders._load(order_id)
        payment = (await self.db.execute(select(Payment).where(Payment.order_id == order_id))).scalar_one_or_none()
        shipment = (await self.db.execute(select(Shipment).where(Shipment.order_id == order_id))).scalar_one_or_none()
        shipment_events = []
        if shipment:
            shipment_events = [{"status": e.status, "location": e.location, "notes": e.notes,
                                "actor_role": e.actor_role, "created_at": e.created_at}
                               for e in (await self.db.execute(
                                   select(ShipmentEvent).where(ShipmentEvent.shipment_id == shipment.id).order_by(ShipmentEvent.id)
                               )).scalars().all()]
        buyer = await self.db.get(BuyerProfile, order.buyer_id)
        buyer_email = (await self.db.execute(select(User.email).where(User.id == buyer.user_id))).scalar_one_or_none()
        messages = []
        try:
            convo = await (await get_conversations_collection()).find_one({"sellerId": order.seller_id, "buyerId": order.buyer_id})
            if convo:
                cursor = (await get_messages_collection()).find({"conversationId": convo["_id"]}).sort("createdAt", -1).limit(50)
                messages = [{"sender": m.get("senderType"), "content": m.get("content"),
                             "translated_content": m.get("translatedContent"), "created_at": m.get("createdAt")}
                            async for m in cursor][::-1]
        except Exception:
            messages = []
        disputes = (await self.db.execute(select(Dispute).where(Dispute.order_id == order_id))).scalars().all()
        offers = (await self.db.execute(
            select(NegotiationOffer).where(NegotiationOffer.fulfilled_order_id == order_id)
        )).scalars().all()
        return {
            **detail,
            "buyer": {"id": buyer.id, "name": f"{buyer.first_name} {buyer.last_name}".strip(), "email": buyer_email,
                      "phone": buyer.phone},
            "payment": {"provider": payment.provider, "status": payment.status, "amount": payment.amount,
                        "reference": payment.reference, "settlement_status": payment.settlement_status,
                        "settled_at": payment.settled_at} if payment else None,
            "shipment_events": shipment_events,
            "tracking": await orders.get_tracking(admin, order_id),
            "communication": messages,
            "negotiation": [{"offered_price": o.offered_price, "quantity": o.quantity, "status": _v(o.status)} for o in offers],
            "disputes": [{"id": d.id, "reason": d.reason, "status": d.status, "description": d.description,
                          "resolution": d.resolution, "raised_by_role": d.raised_by_role} for d in disputes],
        }

    # ── Analytics ──

    async def analytics(self, days: int = 30) -> dict:
        since = datetime.utcnow() - timedelta(days=days)
        daily = (await self.db.execute(
            select(func.date(Order.created_at), func.count(Order.id), func.coalesce(func.sum(Order.total_amount), 0))
            .where(Order.created_at >= since, Order.status.notin_(("cancelled", "refunded")))
            .group_by(func.date(Order.created_at)).order_by(func.date(Order.created_at))
        )).all()
        by_status = {_v(k): v for k, v in (await self.db.execute(
            select(Order.status, func.count(Order.id)).group_by(Order.status)
        )).all()}
        top_categories = (await self.db.execute(
            select(Product.category, func.sum(OrderItem.total_price).label("revenue"))
            .join(OrderItem, OrderItem.product_id == Product.id).join(Order, Order.id == OrderItem.order_id)
            .where(Order.status.notin_(("cancelled", "refunded")))
            .group_by(Product.category).order_by(func.sum(OrderItem.total_price).desc()).limit(5)
        )).all()
        top_sellers = (await self.db.execute(
            select(SellerProfile.business_name, func.count(Order.id), func.sum(Order.total_amount))
            .join(Order, Order.seller_id == SellerProfile.id)
            .where(Order.status.notin_(("cancelled", "refunded")))
            .group_by(SellerProfile.business_name).order_by(func.sum(Order.total_amount).desc()).limit(5)
        )).all()
        buyers_with_orders = (await self.db.execute(select(func.count(func.distinct(Order.buyer_id))))).scalar() or 0
        repeat_buyers = (await self.db.execute(
            select(func.count()).select_from(
                select(Order.buyer_id).group_by(Order.buyer_id).having(func.count(Order.id) > 1).subquery()
            )
        )).scalar() or 0
        offers = dict((await self.db.execute(
            select(NegotiationOffer.status, func.count(NegotiationOffer.id))
            .where(NegotiationOffer.offered_by == "buyer").group_by(NegotiationOffer.status)
        )).all())
        offers = {_v(k): v for k, v in offers.items()}
        avg_rating = (await self.db.execute(select(func.avg(Review.rating)))).scalar()
        delivered_rows = (await self.db.execute(
            select(Shipment.picked_up_at, Shipment.delivered_at).where(Shipment.delivered_at.isnot(None),
                                                                        Shipment.picked_up_at.isnot(None))
        )).all()
        avg_delivery_hours = (sum((d - p).total_seconds() for p, d in delivered_rows) / len(delivered_rows) / 3600
                              if delivered_rows else None)
        total_offers = sum(offers.values())
        return {
            "daily": [{"date": str(d), "orders": n, "revenue": round(float(r), 2)} for d, n, r in daily],
            "orders_by_status": by_status,
            "top_categories": [{"category": c, "revenue": round(float(r or 0), 2)} for c, r in top_categories],
            "top_sellers": [{"seller": s, "orders": n, "revenue": round(float(r or 0), 2)} for s, n, r in top_sellers],
            "repeat_purchase_rate": round(repeat_buyers / buyers_with_orders, 3) if buyers_with_orders else 0.0,
            "negotiation_acceptance_rate": round(offers.get("accepted", 0) / total_offers, 3) if total_offers else 0.0,
            "buyer_satisfaction": round(float(avg_rating), 2) if avg_rating else None,
            "avg_delivery_hours": round(avg_delivery_hours, 1) if avg_delivery_hours is not None else None,
        }

    # ── Settlements ──

    async def run_settlements(self, admin) -> dict:
        """Pay out delivered orders (mock payout until a payout provider is set up)."""
        rows = (await self.db.execute(
            select(Payment, Order).join(Order, Order.id == Payment.order_id)
            .where(Payment.settlement_status == "scheduled", Payment.status == "completed")
        )).all()
        per_seller: dict[int, float] = {}
        for payment, order in rows:
            payment.settlement_status = "settled"
            payment.settled_at = datetime.utcnow()
            per_seller[order.seller_id] = per_seller.get(order.seller_id, 0.0) + (order.total_amount - (order.platform_fee or 0))
        for seller_id, amount in per_seller.items():
            user_id = (await self.db.execute(select(SellerProfile.user_id).where(SellerProfile.id == seller_id))).scalar_one_or_none()
            await self.notifications.notify(user_id, "payment_settled", "Payment settled",
                                            f"₹{amount:,.2f} has been settled to your account.", {"amount": amount})
        self._audit(admin.id, "settlement.run", "payment", None, f"{len(rows)} payments settled")
        await self.db.flush()
        return {"settled_payments": len(rows), "sellers_paid": len(per_seller),
                "total_paid_out": round(sum(per_seller.values()), 2)}

    async def list_audit_logs(self, limit: int = 100) -> list:
        logs = (await self.db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit))).scalars().all()
        return [{"id": log.id, "user_id": log.user_id, "action": log.action, "resource_type": log.resource_type,
                 "resource_id": log.resource_id, "changes": log.changes, "created_at": log.created_at} for log in logs]
