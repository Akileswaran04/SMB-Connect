"""Proof-of-delivery OTP. Derived from the server secret and the shipment, so
nothing secret is stored: the buyer's order page can always show it and the
courier's entry is checked by recomputing it."""
import hashlib
import hmac

from app.core.config import settings


def delivery_otp(shipment_id: int, shipment_number: str) -> str:
    digest = hmac.new(
        settings.SECRET_KEY.encode(), f"pod:{shipment_id}:{shipment_number}".encode(), hashlib.sha256,
    ).hexdigest()
    return f"{int(digest[:12], 16) % 1_000_000:06d}"


def verify_delivery_otp(shipment_id: int, shipment_number: str, code: str) -> bool:
    return hmac.compare_digest(delivery_otp(shipment_id, shipment_number), (code or "").strip())
