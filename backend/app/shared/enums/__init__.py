
from enum import Enum


class SellerProfileStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    VERIFIED = "verified"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class UserRole(str, Enum):
    SELLER = "seller"
    BUYER = "buyer"
    ADMIN = "admin"


class BusinessType(str, Enum):
    GROCERY = "grocery"
    CLOTHING = "clothing"
    ELECTRONICS = "electronics"
    HOME_KITCHEN = "home_kitchen"
    BEAUTY = "beauty"
    FOOD_BEVERAGES = "food_beverages"
    HANDICRAFTS = "handicrafts"
    MANUFACTURING = "manufacturing"
    RETAIL = "retail"
    SERVICES = "services"
    OTHER = "other"


class VerificationType(str, Enum):
    GST_CERTIFICATE = "gst_certificate"
    SHOP_LICENSE = "shop_license"
    ID_PROOF = "id_proof"
    ADDRESS_PROOF = "address_proof"
    BANK_STATEMENT = "bank_statement"
    OTHER = "other"
