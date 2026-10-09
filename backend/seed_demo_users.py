import asyncio
import sys
from datetime import timedelta

from sqlalchemy import select, text

from app.core.security import hash_password
from app.infrastructure.postgres.database import AsyncSessionLocal
from app.infrastructure.mongodb.database import MongoDBClient
from app.infrastructure.mongodb.chat import ensure_chat_indexes, utcnow
import app.modules.all_models  # noqa: F401
from app.modules.seller_profile.models import User, SellerProfile, SellerVerification, Product
from app.modules.inventory.models import ProductVariant
from app.modules.catalogue.models import Category
from app.modules.logistics.models import LogisticsProfile
from app.modules.negotiation.models import NegotiationRule
from app.modules.buyer_profile.models import BuyerProfile
from app.modules.unified_inbox.repository import ConversationRepository, MessageRepository
from app.modules.ai_communication.sentiment import analyze_message

DEMO_PASSWORD = "demo1234"


DEMO_ACCOUNTS = [
    {
        "key": "seller1",
        "email": "seller1@technova.local",
        "role": "seller",
        "full_name": "Murugan Selvam",
        "seller": {
            "business_name": "Murugan Silks",
            "business_type": "textiles",
            "description": "Kanchipuram silk sarees and veshtis woven by families of weavers in Kanchipuram.",
            "city": "Kanchipuram",
            "state": "Tamil Nadu",
            "license_number": "LIC-TN-001",
        },
        "products": [
            {"name": "Kanchipuram Pure Silk Saree", "description": "Handwoven pure zari silk saree with temple border.", "category": "Clothing", "price": 8999.0, "stock": 12, "likes": 210,
             "delivery_days": 5, "return_days": 7, "return_policy": "Unused, with tags, in original packing.",
             "specifications": {"Fabric": "Pure mulberry silk", "Zari": "Silver zari, gold plated", "Length": "6.3 m with blouse"},
             "negotiation": {"min_price": 8000, "auto_accept": 8600, "max_rounds": 2}},
            {"name": "Silk Veshti with Angavastram", "description": "Traditional silk veshti set for weddings and festivals.", "category": "Clothing", "price": 2499.0, "stock": 30, "likes": 96,
             "delivery_days": 4, "specifications": {"Fabric": "Art silk", "Size": "Free size (2 m)"}},
            {"name": "Cotton Saree - Madurai Sungudi", "description": "Light cotton saree with the classic Sungudi dot print.", "category": "Clothing", "price": 1299.0, "stock": 45, "likes": 78,
             "sale_price": 1149.0, "delivery_days": 4, "specifications": {"Fabric": "Cotton", "Length": "5.5 m"}},
        ],
        "conversation_with": "buyer1",
        "thread": [
            ("buyer", "Vanakkam! Kanchipuram saree maroon color la iruka?"),
            ("seller", "Vanakkam! Aama, maroon and mayil kazhuthu blue rendum stock iruku."),
            ("buyer", "Kalyanathukku vaanganum. Konjam price kuraikka mudiyuma?"),
            ("seller", "2 sarees vaanginaa 8% discount tharen. Order podalama?"),
            ("buyer", "Sari, 2 sarees order pannidren. Nandri!"),
        ],
    },
    {
        "key": "seller2",
        "email": "seller2@technova.local",
        "role": "seller",
        "full_name": "Lakshmi Narayanan",
        "seller": {
            "business_name": "Lakshmi Filter Coffee",
            "business_type": "food",
            "description": "Freshly roasted filter coffee, spices and pickles from Kumbakonam.",
            "city": "Kumbakonam",
            "state": "Tamil Nadu",
            "license_number": "LIC-TN-002",
        },
        "products": [
            {"name": "Kumbakonam Degree Coffee Powder (500g)", "description": "Peaberry and arabica blend with 20 percent chicory.", "category": "Food & Spices", "price": 320.0, "stock": 150, "likes": 187,
             "delivery_days": 3, "express_available": True, "return_days": 0, "return_policy": "Food items can't be returned once opened.",
             "bulk_pricing": [{"min_qty": 5, "unit_price": 290.0}], "specifications": {"Blend": "80% coffee, 20% chicory", "Roast": "Medium-dark"}},
            {"name": "Homemade Mango Thokku (250g)", "description": "Spicy mango pickle made with gingelly oil.", "category": "Food & Spices", "price": 180.0, "stock": 80, "likes": 64,
             "delivery_days": 3, "return_days": 0, "return_policy": "Food items can't be returned once opened."},
            {"name": "Cold Pressed Gingelly Oil (1L)", "description": "Chekku ennai from a traditional wooden press.", "category": "Groceries", "price": 520.0, "stock": 40, "likes": 91,
             "delivery_days": 3, "express_available": True, "return_days": 0},
        ],
        "conversation_with": "buyer2",
        "thread": [
            ("buyer", "Coffee powder fresh ah roast pannathu ah?"),
            ("seller", "Aama, every week fresh roast pannitu dhaan anupuvom."),
            ("buyer", "Chennai ku delivery ku evlo naal aagum?"),
            ("seller", "2 to 3 naal la vandhurum, courier la anupuren."),
            ("buyer", "Super, 2 packet order pannaren."),
        ],
    },
    {
        "key": "seller3",
        "email": "seller3@technova.local",
        "role": "seller",
        "full_name": "Karthik Rajan",
        "seller": {
            "business_name": "Karthik Handicrafts",
            "business_type": "handicrafts",
            "description": "Thanjavur paintings, bronze idols and wooden toys made by local artisans.",
            "city": "Thanjavur",
            "state": "Tamil Nadu",
            "license_number": "LIC-TN-003",
        },
        "products": [
            {"name": "Thanjavur Painting - Lord Krishna", "description": "Gold foil Thanjavur painting, framed in teak.", "category": "Home Decor", "price": 5499.0, "stock": 6, "likes": 143,
             "delivery_days": 6, "return_days": 7, "specifications": {"Size": "12 x 15 inch", "Frame": "Teak wood"},
             "negotiation": {"min_price": 4800, "auto_accept": 5200, "max_rounds": 2}},
            {"name": "Bronze Nataraja Idol (8 inch)", "description": "Lost-wax cast bronze Nataraja from Swamimalai.", "category": "Home Decor", "price": 3999.0, "stock": 9, "likes": 118,
             "delivery_days": 5, "specifications": {"Material": "Bronze", "Height": "8 inch", "Weight": "2.5 kg"}},
            {"name": "Wooden Lacquer Toys Set", "description": "Colourful lacquered wooden toys for kids.", "category": "Toys", "price": 699.0, "stock": 3, "likes": 52,
             "delivery_days": 4, "specifications": {"Material": "Lacquered wood", "Age": "3+ years"}},
        ],
        "conversation_with": "buyer3",
        "thread": [
            ("buyer", "Nataraja idol oda weight evlo irukum?"),
            ("seller", "Around 2.5 kg irukum, romba nalla finishing."),
            ("buyer", "Gift pack pannitu Madurai ku anupa mudiyuma?"),
            ("seller", "Kandippa, gift box la pack pannitu anupuren."),
            ("buyer", "Nandri anna, order podren."),
        ],
    },
    {
        "key": "seller4",
        "email": "seller4@technova.local",
        "role": "seller",
        "full_name": "Selvi Arumugam",
        "seller": {
            "business_name": "Chennai Footwear Co",
            "business_type": "footwear",
            "description": "Leather formal and casual footwear made in Ambur and Vaniyambadi.",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "license_number": "LIC-TN-004",
        },
        "products": [
            {"name": "Black Formal Oxford Shoe", "description": "Genuine leather black Oxford with a cushioned insole - comfortable for college and office.",
             "category": "Footwear", "price": 1299.0, "stock": 0, "likes": 88, "delivery_days": 2, "express_available": True,
             "return_days": 10, "return_policy": "Free size exchange within 10 days; unworn only.",
             "specifications": {"Upper": "Genuine leather", "Sole": "TPR, cushioned", "Closure": "Lace-up"},
             "variants": [{"size": s, "color": "Black", "stock": n} for s, n in [("7", 4), ("8", 9), ("9", 12), ("10", 6)]],
             "negotiation": {"min_price": 1150, "auto_accept": 1200, "max_rounds": 2}},
            {"name": "Black Formal Derby Shoe", "description": "Classic black derby in synthetic leather with a simpler sole - great value for daily wear.",
             "category": "Footwear", "price": 999.0, "stock": 0, "likes": 41, "delivery_days": 4,
             "return_days": 7, "specifications": {"Upper": "Synthetic leather", "Sole": "PVC", "Closure": "Lace-up"},
             "variants": [{"size": s, "color": "Black", "stock": n} for s, n in [("7", 5), ("8", 7), ("9", 8), ("10", 3)]]},
            {"name": "Premium Black Brogue", "description": "Hand-finished leather brogue with a leather sole - the premium pick for formal occasions.",
             "category": "Footwear", "price": 1399.0, "stock": 0, "likes": 67, "delivery_days": 1, "express_available": True,
             "return_days": 10, "specifications": {"Upper": "Full-grain leather", "Sole": "Leather", "Closure": "Lace-up"},
             "variants": [{"size": s, "color": "Black", "stock": n} for s, n in [("8", 3), ("9", 5), ("10", 2)]]},
            {"name": "Tan Casual Loafer", "description": "Soft suede loafer for casual days.",
             "category": "Footwear", "price": 1199.0, "stock": 0, "likes": 23, "delivery_days": 3, "return_days": 7,
             "specifications": {"Upper": "Suede", "Sole": "Rubber"},
             "variants": [{"size": s, "color": "Tan", "stock": n} for s, n in [("8", 4), ("9", 4)]]},
        ],
        "conversation_with": "buyer2",
        "thread": [
            ("buyer", "Formal shoe size 9 black la iruka?"),
            ("seller", "Iruku sir, Oxford and Derby rendum size 9 la stock iruku."),
            ("buyer", "College ku daily use ku edhu nallathu?"),
            ("seller", "Oxford cushioned insole, daily use ku comfortable-a irukum."),
        ],
    },
]

DEMO_LOGISTICS = [
    {"key": "logistics1", "email": "logistics1@technova.local", "full_name": "Ravi Kumar",
     "company_name": "SwiftShip Chennai", "service_city": "Chennai", "vehicle_type": "Bike", "vehicle_number": "TN09 AB 1234",
     "phone": "9876500001"},
    {"key": "logistics2", "email": "logistics2@technova.local", "full_name": "Meena Rajan",
     "company_name": "Kaveri Express", "service_city": "Thanjavur", "vehicle_type": "Van", "vehicle_number": "TN49 CD 5678",
     "phone": "9876500002"},
]

DEFAULT_CATEGORIES = [
    ("Footwear", "steps"), ("Clothing", "checkroom"), ("Electronics", "devices"), ("Home Decor", "chair"),
    ("Groceries", "local_grocery_store"), ("Food & Spices", "restaurant"), ("Business Supplies", "inventory_2"),
    ("Toys", "toys"),
]

DEMO_BUYERS = [
    {"key": "buyer1", "email": "buyer1@technova.local", "full_name": "Priya Sundaram", "first_name": "Priya", "last_name": "Sundaram", "city": "Chennai"},
    {"key": "buyer2", "email": "buyer2@technova.local", "full_name": "Arun Kumar", "first_name": "Arun", "last_name": "Kumar", "city": "Coimbatore"},
    {"key": "buyer3", "email": "buyer3@technova.local", "full_name": "Divya Balasubramanian", "first_name": "Divya", "last_name": "Balasubramanian", "city": "Madurai"},
]

DEMO_ADMIN = {"key": "admin", "email": "admin@technova.local", "full_name": "TechNova Admin"}


async def _get_or_create_user(db, email, role, full_name, extra=None):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        return user, False
    user = User(
        email=email,
        password_hash=hash_password(DEMO_PASSWORD),
        full_name=full_name,
        role=role,
        is_active=True,
        **(extra or {}),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user, True


async def _get_or_create_seller(db, user, seller_data):
    result = await db.execute(select(SellerProfile).where(SellerProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if profile:
        return profile
    profile = SellerProfile(
        user_id=user.id,
        business_name=seller_data["business_name"],
        business_type=seller_data["business_type"],
        description=seller_data.get("description"),
        city=seller_data.get("city"),
        state=seller_data.get("state"),
        country="India",
        license_number=seller_data.get("license_number"),
        verification_status="verified",
    )
    db.add(profile)
    await db.flush()
    await db.refresh(profile)
    db.add(SellerVerification(
        seller_id=profile.id,
        verification_type="business_license",
        document_reference=f"doc-{user.email}",
        status="approved",
        reviewed_by=None,
        reviewed_at=utcnow(),
    ))
    return profile


async def _get_or_create_buyer(db, user, buyer_data):
    result = await db.execute(select(BuyerProfile).where(BuyerProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if profile:
        return profile
    profile = BuyerProfile(
        user_id=user.id,
        first_name=buyer_data["first_name"],
        last_name=buyer_data["last_name"],
        city=buyer_data.get("city"),
        country="India",
        preferred_payment_method="mock",
    )
    db.add(profile)
    await db.flush()
    await db.refresh(profile)
    return profile


_EXTRA_FIELDS = ("delivery_days", "express_available", "return_days", "return_policy", "specifications",
                 "sale_price", "bulk_pricing")
# Column defaults: an existing product still holding these hasn't been
# given real details yet, so the seed may fill them in.
_UNSET = {"delivery_days": 4, "express_available": False, "return_days": 7}


async def _seed_products(db, seller_profile, products):
    """Create missing products; fill in delivery/return/spec details on
    existing ones that still have defaults (idempotent)."""
    existing = {p.name: p for p in (await db.execute(
        select(Product).where(Product.seller_id == seller_profile.id)
    )).scalars().all()}
    now = utcnow().replace(tzinfo=None)
    for p in products:
        product = existing.get(p["name"])
        if product is None:
            product = Product(
                seller_id=seller_profile.id, name=p["name"], description=p["description"],
                category=p["category"], price=p["price"], stock=p["stock"], low_stock_threshold=5,
                likes=p.get("likes", 0), status="published", created_at=now, updated_at=now,
                sku=f"S{seller_profile.id}-{len(existing) + 1:03d}",
            )
            db.add(product)
            await db.flush()
            existing[p["name"]] = product
        for field in _EXTRA_FIELDS:
            current = getattr(product, field)
            if field in p and (current is None or current == _UNSET.get(field, object())):
                setattr(product, field, p[field])
        if p.get("variants") and not (await db.execute(
            select(ProductVariant.id).where(ProductVariant.product_id == product.id).limit(1)
        )).scalar_one_or_none():
            for v in p["variants"]:
                db.add(ProductVariant(product_id=product.id, sku=f"{product.sku or product.id}-{v['size']}",
                                      size=v["size"], color=v["color"], stock=v["stock"]))
            product.stock = sum(v["stock"] for v in p["variants"])
        rule = p.get("negotiation")
        if rule and not (await db.execute(
            select(NegotiationRule.id).where(NegotiationRule.product_id == product.id)
        )).scalar_one_or_none():
            db.add(NegotiationRule(product_id=product.id, enabled=True, min_price=rule["min_price"],
                                   auto_accept_threshold=rule.get("auto_accept"), max_rounds=rule.get("max_rounds", 2),
                                   counter_offer_range_pct=10.0, quantity_discount_rules=[]))


async def _seed_logistics(db):
    for entry in DEMO_LOGISTICS:
        user, created = await _get_or_create_user(db, entry["email"], "logistics", entry["full_name"])
        if not (await db.execute(select(LogisticsProfile).where(LogisticsProfile.user_id == user.id))).scalar_one_or_none():
            db.add(LogisticsProfile(user_id=user.id, company_name=entry["company_name"], contact_name=entry["full_name"],
                                    phone=entry["phone"], vehicle_type=entry["vehicle_type"],
                                    vehicle_number=entry["vehicle_number"], service_city=entry["service_city"]))
        print(f"  {'created' if created else 'exists '} logistics {entry['email']} - {entry['company_name']}")


async def _seed_categories(db):
    if (await db.execute(select(Category.id).limit(1))).scalar_one_or_none():
        return
    for i, (name, icon) in enumerate(DEFAULT_CATEGORIES):
        db.add(Category(name=name, icon=icon, sort_order=i))


async def _seed_conversation(convo_repo, msg_repo, seller_profile_id, buyer_profile_id, thread):
    from app.infrastructure.mongodb.chat import get_messages_collection, get_conversations_collection
    from bson import ObjectId

    convo = await convo_repo.get_or_create(seller_profile_id, buyer_profile_id)
    msgs_coll = await get_messages_collection()
    convos_coll = await get_conversations_collection()

    existing = await msg_repo.get_page(convo["_id"], limit=200)
    if len(existing[0]) < len(thread):
        await msgs_coll.delete_many({"conversationId": convo["_id"]})
        await convos_coll.update_one(
            {"_id": ObjectId(convo["_id"])},
            {"$set": {"unreadCount": 0, "unreadFor": None, "lastMessage": None, "lastMessageAt": None}},
        )

        base_time = utcnow() - timedelta(hours=len(thread))
        for i, (sender_type, content) in enumerate(thread):
            msg_time = base_time + timedelta(minutes=5 * i)
            sequence = await msg_repo.next_sequence(str(convo["_id"]))
            doc = {
                "conversationId": convo["_id"],
                "senderId": buyer_profile_id if sender_type == "buyer" else seller_profile_id,
                "senderType": sender_type,
                "senderName": None,
                "content": content,
                "messageType": "text",
                "source": "in_app",
                "sentiment": await analyze_message(content),
                "sequenceNumber": sequence,
                "attachments": [],
                "createdAt": msg_time,
                "readAt": None,
                "isAiGenerated": False,
            }
            await msg_repo.create(doc)
            recipient = seller_profile_id if sender_type == "buyer" else buyer_profile_id
            await convo_repo.update_last_message(str(convo["_id"]), content, recipient)

    unread = await msgs_coll.count_documents({
        "conversationId": convo["_id"],
        "senderId": buyer_profile_id,
        "readAt": None,
    })
    await convos_coll.update_one(
        {"_id": ObjectId(convo["_id"])},
        {"$set": {"unreadCount": unread, "unreadFor": seller_profile_id}},
    )
    return convo


async def reset_all():
    async with AsyncSessionLocal() as db:
        rows = await db.execute(text(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'alembic_version'"
        ))
        tables = [r[0] for r in rows]
        if tables:
            names = ", ".join('"' + t + '"' for t in tables)
            await db.execute(text("TRUNCATE TABLE " + names + " RESTART IDENTITY CASCADE"))
        await db.commit()
    print("  cleared", len(tables), "postgres tables")

    await MongoDBClient.connect_to_db()
    from app.infrastructure.mongodb.chat import get_messages_collection, get_conversations_collection
    await (await get_messages_collection()).delete_many({})
    await (await get_conversations_collection()).delete_many({})
    await MongoDBClient.close_connection()
    print("  cleared mongo chat collections")


async def seed():
    if "--reset" in sys.argv:
        await reset_all()
    buyers_by_key = {}
    sellers_by_key = {}

    async with AsyncSessionLocal() as db:
        for b in DEMO_BUYERS:
            user, created = await _get_or_create_user(db, b["email"], "buyer", b["full_name"])
            profile = await _get_or_create_buyer(db, user, b)
            buyers_by_key[b["key"]] = (user, profile)
            print(f"  {'created' if created else 'exists '} buyer {b['email']}")

        for s in DEMO_ACCOUNTS:
            user, created = await _get_or_create_user(db, s["email"], "seller", s["full_name"])
            profile = await _get_or_create_seller(db, user, s["seller"])
            sellers_by_key[s["key"]] = (user, profile)
            await _seed_products(db, profile, s["products"])
            print(f"  {'created' if created else 'exists '} seller {s['email']} — {s['seller']['business_name']}")

        admin_user, admin_created = await _get_or_create_user(db, DEMO_ADMIN["email"], "admin", DEMO_ADMIN["full_name"])
        print(f"  {'created' if admin_created else 'exists '} admin {DEMO_ADMIN['email']}")

        await _seed_logistics(db)
        await _seed_categories(db)

        await db.commit()

    await MongoDBClient.connect_to_db()
    await ensure_chat_indexes()
    convo_repo = ConversationRepository()
    msg_repo = MessageRepository()
    for s in DEMO_ACCOUNTS:
        seller_profile_id = sellers_by_key[s["key"]][1].id
        buyer_profile_id = buyers_by_key[s["conversation_with"]][1].id
        await _seed_conversation(convo_repo, msg_repo, seller_profile_id, buyer_profile_id, s["thread"])
        print(f"  seeded conversation {s['key']} ↔ {s['conversation_with']}")
    await MongoDBClient.close_connection()

    print()
    print("Demo accounts ready (password for all: demo1234)")
    for a in DEMO_ACCOUNTS:
        print("   Seller:", a["email"], "-", a["seller"]["business_name"])
    for b in DEMO_BUYERS:
        print("   Buyer: ", b["email"], "-", b["full_name"])
    for lp in DEMO_LOGISTICS:
        print("   Logistics:", lp["email"], "-", lp["company_name"])
    print("   Admin: ", DEMO_ADMIN["email"])

if __name__ == "__main__":
    asyncio.run(seed())