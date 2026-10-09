"""Shipment Service — seller shipment creation, logistics pickup/delivery,
live tracking and proof of delivery (PRD §38, §41–45).

Shipment states: created → pickup_assigned → picked_up → at_hub → in_transit
→ out_for_delivery → delivered (or delivery_failed → retry / returned).
Each step writes a ShipmentEvent and moves the order along through
OrderService.transition, so order tracking, inventory and notifications stay
in step with the parcel.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, ForbiddenException, ValidationException
from app.modules.buyer_profile.models import BuyerProfile
from app.modules.logistics.models import LogisticsProfile
from app.modules.notifications.service import NotificationService
from app.modules.orders.models import Order
from app.modules.orders.service import OrderService
from app.modules.seller_profile.models import SellerProfile, User
from app.modules.shipments.models import Shipment, ShipmentEvent
from app.modules.shipments.otp import delivery_otp, verify_delivery_otp

_SHIP_TRANSITIONS: dict[str, set[str]] = {
    "created": {"pickup_assigned"},
    "pickup_assigned": {"picked_up"},
    "picked_up": {"at_hub", "in_transit"},
    "at_hub": {"in_transit"},
    "in_transit": {"at_hub", "out_for_delivery"},
    "out_for_delivery": {"delivered", "delivery_failed"},
    "delivery_failed": {"out_for_delivery", "returned_to_seller"},
}
# Order status each shipment step implies (None = order already there).
_ORDER_STATUS = {
    "picked_up": "picked_up", "at_hub": "in_transit", "in_transit": "in_transit",
    "out_for_delivery": "out_for_delivery", "delivered": "delivered",
    "delivery_failed": "delivery_failed", "returned_to_seller": "returned",
}
ACTIVE = ("pickup_assigned", "picked_up", "at_hub", "in_transit", "out_for_delivery", "delivery_failed")


def _status(value) -> str:
    return value.value if hasattr(value, "value") else value


class ShipmentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.orders = OrderService(db)
        self.notifications = NotificationService(db)

    # ── Access ──

    async def _seller(self, user) -> SellerProfile:
        seller = (await self.db.execute(select(SellerProfile).where(SellerProfile.user_id == user.id))).scalar_one_or_none()
        if not seller:
            raise ForbiddenException("Only sellers can do this")
        return seller

    async def _partner(self, user) -> LogisticsProfile:
        partner = (await self.db.execute(select(LogisticsProfile).where(LogisticsProfile.user_id == user.id))).scalar_one_or_none()
        if not partner:
            raise ForbiddenException("Only logistics partners can do this")
        return partner

    async def _load(self, shipment_id: int) -> Shipment:
        shipment = await self.db.get(Shipment, shipment_id)
        if not shipment:
            raise NotFoundException("Shipment", str(shipment_id))
        return shipment

    async def _assert_access(self, user, shipment: Shipment) -> None:
        """PRD §61: sellers see their own shipments, buyers their own orders,
        partners only what is assigned to them."""
        if user.role == "admin":
            return
        if user.role == "seller" and shipment.seller_id == (await self._seller(user)).id:
            return
        if user.role == "logistics" and shipment.logistics_partner_id == (await self._partner(user)).id:
            return
        if user.role == "buyer":
            buyer_id = (await self.db.execute(select(BuyerProfile.id).where(BuyerProfile.user_id == user.id))).scalar_one_or_none()
            if buyer_id == shipment.buyer_id:
                return
        raise ForbiddenException("You don't have access to this shipment")

    # ── Serialization ──

    async def _serialize(self, s: Shipment, viewer_role: str, with_events: bool = True) -> dict:
        order = await self.db.get(Order, s.order_id)
        seller = await self.db.get(SellerProfile, s.seller_id)
        buyer = await self.db.get(BuyerProfile, s.buyer_id)
        buyer_phone = buyer.phone
        if not buyer_phone:
            buyer_phone = (await self.db.execute(select(User.phone).where(User.id == buyer.user_id))).scalar_one_or_none()
        partner = await self.db.get(LogisticsProfile, s.logistics_partner_id) if s.logistics_partner_id else None
        events = []
        if with_events:
            events = [{"status": e.status, "location": e.location, "notes": e.notes, "actor_role": e.actor_role,
                       "created_at": e.created_at}
                      for e in (await self.db.execute(
                          select(ShipmentEvent).where(ShipmentEvent.shipment_id == s.id).order_by(ShipmentEvent.id)
                      )).scalars().all()]
        return {
            "id": s.id, "shipment_number": s.shipment_number, "tracking_id": s.shipment_number,
            "order_id": s.order_id, "order_number": order.order_number if order else None,
            "order_status": _status(order.status) if order else None,
            "status": s.status,
            "package_count": s.package_count, "weight_kg": s.weight_kg,
            "dimensions_cm": [s.length_cm, s.width_cm, s.height_cm] if s.length_cm else None,
            "pickup_address": s.pickup_address, "delivery_address": s.delivery_address,
            "seller": {"id": seller.id, "name": seller.business_name, "phone": seller.phone},
            "buyer": {"id": buyer.id, "name": f"{buyer.first_name} {buyer.last_name}".strip(),
                      "phone": buyer_phone if viewer_role in ("logistics", "admin", "seller") else None},
            "partner": {"id": partner.id, "company_name": partner.company_name, "phone": partner.phone,
                        "vehicle_number": partner.vehicle_number} if partner else None,
            "scheduled_pickup_at": s.scheduled_pickup_at, "accepted_at": s.accepted_at,
            "picked_up_at": s.picked_up_at, "delivered_at": s.delivered_at,
            "expected_delivery_at": s.expected_delivery_at, "current_location": s.current_location,
            "order_total": order.total_amount if order else None,
            "cash_to_collect": order.total_amount if order and order.payment_method == "cod"
                               and _status(order.status) != "delivered" else 0.0,
            "proof_of_delivery": {
                "otp_verified": s.pod_otp_verified, "signature_name": s.pod_signature_name,
                "photo_url": s.pod_photo_url, "recorded_at": s.pod_recorded_at,
            } if s.pod_recorded_at else None,
            "failure_reason": s.failure_reason, "delivery_attempts": s.delivery_attempts,
            "delivery_otp": delivery_otp(s.id, s.shipment_number) if viewer_role == "buyer" and s.status != "delivered" else None,
            "events": events,
            "created_at": s.created_at, "updated_at": s.updated_at,
        }

    # ── Seller ──

    async def _pick_partner(self, city: Optional[str]) -> Optional[LogisticsProfile]:
        """Available partner with the fewest active shipments, preferring the
        seller's city."""
        load = (
            select(Shipment.logistics_partner_id, func.count(Shipment.id).label("n"))
            .where(Shipment.status.in_(ACTIVE)).group_by(Shipment.logistics_partner_id).subquery()
        )
        rows = (await self.db.execute(
            select(LogisticsProfile, func.coalesce(load.c.n, 0))
            .outerjoin(load, load.c.logistics_partner_id == LogisticsProfile.id)
            .join(User, User.id == LogisticsProfile.user_id)
            .where(LogisticsProfile.is_available.is_(True), User.is_active.is_(True))
        )).all()
        if not rows:
            return None
        local = [r for r in rows if city and r[0].service_city and r[0].service_city.lower() == city.lower()]
        return min(local or rows, key=lambda r: r[1])[0]

    async def create(self, user, data) -> dict:
        seller = await self._seller(user)
        order = await self.db.get(Order, data.order_id)
        if not order or order.seller_id != seller.id:
            raise NotFoundException("Order", str(data.order_id))
        if (await self.db.execute(select(Shipment.id).where(Shipment.order_id == order.id))).scalar_one_or_none():
            raise ValidationException("A shipment already exists for this order")
        status = _status(order.status)
        if status not in ("packed", "ready_for_pickup"):
            raise ValidationException("Pack the order before creating a shipment")

        partner = None
        if data.logistics_partner_id:
            partner = await self.db.get(LogisticsProfile, data.logistics_partner_id)
            if not partner or not partner.is_available:
                raise ValidationException("That logistics partner is not available")
        else:
            partner = await self._pick_partner(seller.city)

        pickup = data.pickup_address or ", ".join(
            p for p in [seller.address_line_1, seller.address_line_2, seller.city, seller.state, seller.postal_code] if p
        ) or seller.city
        shipment = Shipment(
            shipment_number=f"SHP-{uuid.uuid4().hex[:10].upper()}",
            order_id=order.id, seller_id=seller.id, buyer_id=order.buyer_id,
            logistics_partner_id=partner.id if partner else None,
            status="pickup_assigned" if partner else "created",
            package_count=data.package_count, weight_kg=data.weight_kg,
            length_cm=data.length_cm, width_cm=data.width_cm, height_cm=data.height_cm,
            pickup_address=pickup, delivery_address=order.shipping_address,
            scheduled_pickup_at=data.scheduled_pickup_at,
            expected_delivery_at=order.delivery_date,
            current_location=seller.city,
            delivery_otp_hash="hmac-v1",
        )
        self.db.add(shipment)
        await self.db.flush()
        self._event(shipment, "created", user, seller.city, "Shipment created")
        if partner:
            self._event(shipment, "pickup_assigned", user, seller.city, f"Assigned to {partner.company_name}")
            await self.notifications.notify(partner.user_id, "pickup_assigned", "New pickup assigned",
                                            f"Pick up {shipment.shipment_number} from {seller.business_name}.",
                                            {"shipment_id": shipment.id})
        if status == "packed":
            order = await self.orders._load(order.id)
            await self.orders.transition(order, "ready_for_pickup", user.id, "seller", notes="Shipment created")
        await self.notifications.notify_order(
            order, "shipment_created",
            buyer=("Shipment created", f"Order {order.order_number} is packed and ready for pickup. "
                   f"Tracking ID {shipment.shipment_number}."),
            data={"shipment_id": shipment.id},
        )
        await self.db.flush()
        return await self._serialize(shipment, "seller")

    async def assign(self, user, shipment_id: int, partner_id: int) -> dict:
        shipment = await self._load(shipment_id)
        await self._assert_access(user, shipment)
        if user.role not in ("seller", "admin"):
            raise ForbiddenException("Only the seller or an admin can assign a partner")
        if shipment.status not in ("created", "pickup_assigned"):
            raise ValidationException("The parcel has already been picked up")
        partner = await self.db.get(LogisticsProfile, partner_id)
        if not partner or not partner.is_available:
            raise ValidationException("That logistics partner is not available")
        shipment.logistics_partner_id = partner.id
        shipment.accepted_at = None
        shipment.status = "pickup_assigned"
        self._event(shipment, "pickup_assigned", user, shipment.current_location, f"Assigned to {partner.company_name}")
        await self.notifications.notify(partner.user_id, "pickup_assigned", "New pickup assigned",
                                        f"Pick up {shipment.shipment_number}.", {"shipment_id": shipment.id})
        await self.db.flush()
        return await self._serialize(shipment, user.role)

    async def label(self, user, shipment_id: int) -> dict:
        shipment = await self._load(shipment_id)
        await self._assert_access(user, shipment)
        if user.role == "buyer":
            raise ForbiddenException("Not allowed")
        shipment.label_generated_at = shipment.label_generated_at or datetime.utcnow()
        data = await self._serialize(shipment, "seller", with_events=False)
        return {
            "shipment_number": data["shipment_number"], "order_number": data["order_number"],
            "from": {"name": data["seller"]["name"], "address": data["pickup_address"], "phone": data["seller"]["phone"]},
            "to": {"name": data["buyer"]["name"], "address": data["delivery_address"], "phone": data["buyer"]["phone"]},
            "package_count": data["package_count"], "weight_kg": data["weight_kg"],
            "dimensions_cm": data["dimensions_cm"], "partner": data["partner"],
            "cash_to_collect": data["cash_to_collect"], "generated_at": shipment.label_generated_at,
        }

    # ── Logistics partner ──

    async def accept(self, user, shipment_id: int) -> dict:
        shipment = await self._load(shipment_id)
        await self._assert_access(user, shipment)
        if user.role != "logistics":
            raise ForbiddenException("Only the assigned partner can accept a pickup")
        if shipment.status != "pickup_assigned":
            raise ValidationException("This pickup can't be accepted now")
        shipment.accepted_at = datetime.utcnow()
        self._event(shipment, "pickup_assigned", user, shipment.current_location, "Pickup accepted by partner")
        await self.db.flush()
        return await self._serialize(shipment, "logistics")

    async def advance(self, user, shipment_id: int, target: str, location: Optional[str] = None,
                      notes: Optional[str] = None) -> dict:
        """Move the parcel one step (picked up, at hub, in transit, out for
        delivery, failed, returned) and keep the order in step."""
        shipment = await self._load(shipment_id)
        await self._assert_access(user, shipment)
        if user.role not in ("logistics", "admin"):
            raise ForbiddenException("Only the logistics partner updates parcel status")
        if target == "delivered":
            raise ValidationException("Use the delivery endpoint with proof of delivery")
        if target not in _SHIP_TRANSITIONS.get(shipment.status, set()):
            raise ValidationException(f"Cannot move a shipment from '{shipment.status}' to '{target}'")
        if target == "picked_up" and not shipment.accepted_at and user.role == "logistics":
            shipment.accepted_at = datetime.utcnow()

        now = datetime.utcnow()
        if target == "picked_up":
            shipment.picked_up_at = now
        if target == "delivery_failed":
            shipment.delivery_attempts += 1
            shipment.failure_reason = notes or "Delivery attempt failed"
        shipment.status = target
        shipment.current_location = location or shipment.current_location
        shipment.updated_at = now
        self._event(shipment, target, user, shipment.current_location, notes)
        await self._sync_order(shipment, target, user, notes)
        await self.db.flush()
        return await self._serialize(shipment, user.role)

    async def update_location(self, user, shipment_id: int, location: str) -> dict:
        shipment = await self._load(shipment_id)
        await self._assert_access(user, shipment)
        if user.role not in ("logistics", "admin"):
            raise ForbiddenException("Only the logistics partner updates the location")
        if shipment.status not in ACTIVE:
            raise ValidationException("This shipment is not in progress")
        shipment.current_location = location
        shipment.updated_at = datetime.utcnow()
        self._event(shipment, shipment.status, user, location, "Location update")
        await self.db.flush()
        return await self._serialize(shipment, user.role)

    async def deliver(self, user, shipment_id: int, data) -> dict:
        """Proof of delivery (PRD §45): the buyer's OTP, the recipient's name
        as signature, an optional photo, and the time."""
        shipment = await self._load(shipment_id)
        await self._assert_access(user, shipment)
        if user.role not in ("logistics", "admin"):
            raise ForbiddenException("Only the logistics partner can mark delivery")
        if shipment.status != "out_for_delivery":
            raise ValidationException("The parcel must be out for delivery first")
        otp_ok = bool(data.otp) and verify_delivery_otp(shipment.id, shipment.shipment_number, data.otp)
        if not otp_ok and user.role != "admin":
            raise ValidationException("Incorrect delivery OTP — ask the buyer for the code on their order page")
        now = datetime.utcnow()
        shipment.pod_otp_verified = otp_ok
        shipment.pod_signature_name = data.signature_name
        shipment.pod_photo_url = data.photo_url
        shipment.pod_recorded_at = now
        shipment.delivered_at = now
        shipment.status = "delivered"
        shipment.updated_at = now
        self._event(shipment, "delivered", user, shipment.current_location,
                    f"Received by {data.signature_name}" + (" (OTP verified)" if otp_ok else " (admin override)"))
        await self._sync_order(shipment, "delivered", user, "Proof of delivery recorded")
        await self.db.flush()
        return await self._serialize(shipment, user.role)

    async def _sync_order(self, shipment: Shipment, target: str, user, notes: Optional[str]) -> None:
        order_target = _ORDER_STATUS.get(target)
        order = await self.orders._load(shipment.order_id)
        if not order_target or _status(order.status) == order_target:
            return
        role = "admin" if user.role == "admin" else "logistics"
        await self.orders.transition(order, order_target, user.id, role, location=shipment.current_location, notes=notes)

    def _event(self, shipment: Shipment, status: str, user, location: Optional[str], notes: Optional[str]) -> None:
        self.db.add(ShipmentEvent(shipment_id=shipment.id, status=status, location=location, notes=notes,
                                  actor_user_id=user.id if user else None,
                                  actor_role=user.role if user else "system"))

    # ── Queries ──

    async def get(self, user, shipment_id: int) -> dict:
        shipment = await self._load(shipment_id)
        await self._assert_access(user, shipment)
        return await self._serialize(shipment, user.role)

    async def by_order(self, user, order_id: int) -> Optional[dict]:
        shipment = (await self.db.execute(select(Shipment).where(Shipment.order_id == order_id))).scalar_one_or_none()
        if not shipment:
            order = await self.orders._load(order_id)
            await self.orders.assert_access(user, order)
            return None
        await self._assert_access(user, shipment)
        return await self._serialize(shipment, user.role)

    async def list(self, user, view: Optional[str] = None, status: Optional[str] = None) -> list[dict]:
        query = select(Shipment)
        if user.role == "seller":
            query = query.where(Shipment.seller_id == (await self._seller(user)).id)
        elif user.role == "logistics":
            query = query.where(Shipment.logistics_partner_id == (await self._partner(user)).id)
        elif user.role == "buyer":
            buyer_id = (await self.db.execute(select(BuyerProfile.id).where(BuyerProfile.user_id == user.id))).scalar_one_or_none()
            query = query.where(Shipment.buyer_id == buyer_id)
        elif user.role != "admin":
            raise ForbiddenException("Not allowed")
        if view == "pickups":
            query = query.where(Shipment.status.in_(("created", "pickup_assigned")))
        elif view == "deliveries":
            query = query.where(Shipment.status.in_(("picked_up", "at_hub", "in_transit", "out_for_delivery", "delivery_failed")))
        elif view == "completed":
            query = query.where(Shipment.status.in_(("delivered", "returned_to_seller")))
        if status:
            query = query.where(Shipment.status == status)
        rows = (await self.db.execute(query.order_by(Shipment.id.desc()).limit(200))).scalars().all()
        return [await self._serialize(s, user.role, with_events=False) for s in rows]

    async def partner_dashboard(self, user) -> dict:
        partner = await self._partner(user)
        counts = dict((await self.db.execute(
            select(Shipment.status, func.count(Shipment.id))
            .where(Shipment.logistics_partner_id == partner.id).group_by(Shipment.status)
        )).all())
        today = datetime.utcnow().date()
        todays = (await self.db.execute(
            select(func.count(Shipment.id)).where(
                Shipment.logistics_partner_id == partner.id,
                Shipment.status.in_(ACTIVE),
            )
        )).scalar() or 0
        delivered_today = (await self.db.execute(
            select(func.count(Shipment.id)).where(
                Shipment.logistics_partner_id == partner.id,
                func.date(Shipment.delivered_at) == today,
            )
        )).scalar() or 0
        return {
            "partner": {"id": partner.id, "company_name": partner.company_name, "service_city": partner.service_city,
                        "is_available": partner.is_available},
            "assigned_pickups": counts.get("pickup_assigned", 0),
            "active_deliveries": sum(counts.get(s, 0) for s in ("picked_up", "at_hub", "in_transit", "out_for_delivery")),
            "completed_deliveries": counts.get("delivered", 0),
            "failed_deliveries": counts.get("delivery_failed", 0),
            "todays_workload": todays,
            "delivered_today": delivered_today,
        }

    async def notify_delays(self) -> int:
        """Background job: tell buyers once when a parcel runs late (PRD §58)."""
        late = (await self.db.execute(
            select(Shipment).where(
                Shipment.status.in_(ACTIVE), Shipment.expected_delivery_at < datetime.utcnow(),
                Shipment.delay_notified.is_(False),
            )
        )).scalars().all()
        for s in late:
            order = await self.db.get(Order, s.order_id)
            await self.notifications.notify_order(
                order, "shipment_delayed",
                buyer=("Shipment delayed", f"Order {order.order_number} is running late. We'll keep you posted."),
                seller=("Shipment delayed", f"Order {order.order_number} has passed its expected delivery date."),
                dedupe_suffix="delay",
            )
            s.delay_notified = True
        await self.db.flush()
        return len(late)
