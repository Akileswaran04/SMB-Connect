"""Import every ORM model once so string-based relationships always resolve,
whichever module is imported first (app startup, Alembic, scripts)."""
from app.modules.seller_profile.models import (  # noqa: F401
    User, SellerProfile, SellerVerification, Product, ProductReview,
)
from app.modules.buyer_profile.models import BuyerProfile, Address  # noqa: F401
from app.modules.inventory.models import ProductVariant, InventoryTransaction  # noqa: F401
from app.modules.catalogue.models import Category, ProductReport  # noqa: F401
from app.modules.cart.models import Cart, CartItem  # noqa: F401
from app.modules.orders.models import Order, OrderItem, Review, TrackingEvent  # noqa: F401
from app.modules.payments.models import Payment, Transaction  # noqa: F401
from app.modules.negotiation.models import NegotiationRule, NegotiationOffer  # noqa: F401
from app.modules.logistics.models import LogisticsProfile  # noqa: F401
from app.modules.shipments.models import Shipment, ShipmentEvent  # noqa: F401
from app.modules.notifications.models import Notification  # noqa: F401
from app.modules.disputes.models import Dispute  # noqa: F401
from app.modules.platform.models import PlatformSetting  # noqa: F401
from app.modules.assistant.models import RecommendationLog, VoiceSession  # noqa: F401
from app.modules.analytics.models import TrustScore, AnalyticsSummary  # noqa: F401
from app.modules.admin.models import AuditLog  # noqa: F401
