"""End-to-end test of the SMBConnect PRD §71 final product test (35 scenarios)
plus admin, seller hub, returns, disputes, settlements and access control.

Run against a live server (default http://127.0.0.1:8010) after
`alembic upgrade head` and `python seed_demo_users.py`:

    .venv/Scripts/python.exe e2e_prd_test.py [base_url]

It creates its own seller, buyers and logistics partner (unique suffix), so it
can be run repeatedly. Natural-language / Tamil / Tanglish checks use the
seeded footwear catalogue.
"""
import sys
import time
import uuid

import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8010").rstrip("/") + "/api/v1"
S = uuid.uuid4().hex[:6]
CAT = f"Shoes{S}"
client = httpx.Client(timeout=60.0)
results: list[tuple[str, bool, str]] = []


def check(label: str, cond: bool, detail: str = "") -> bool:
    results.append((label, bool(cond), detail))
    print(f"  {'PASS' if cond else 'FAIL'}  {label}" + ("" if cond else f"   <- {detail[:300]}"))
    return bool(cond)


def H(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def req(method: str, path: str, token: str = None, **kw) -> httpx.Response:
    return client.request(method, BASE + path, headers=H(token) if token else None, **kw)


def ok(r: httpx.Response, code: int = 200) -> bool:
    return r.status_code == code


def section(title: str) -> None:
    print(f"\n== {title} ==")


# ─────────────────────────────── Registration ───────────────────────────────
section("1-3 Registration")
r = req("POST", "/auth/register", json={
    "email": f"buyer-{S}@example.com", "password": "secret123", "role": "buyer", "full_name": "Test Buyer",
    "city": "Chennai", "preferred_language": "en", "phone": "9" + str(int(S, 16)).zfill(9)[:9]})
check("1  Buyer can register (with language + city)", ok(r) and r.json()["role"] == "buyer", r.text)
BUYER = r.json()["access_token"]

r = req("POST", "/auth/register", json={
    "email": f"seller-{S}@example.com", "password": "secret123", "role": "seller", "full_name": "Test Seller",
    "business_name": f"Test Shoes {S}", "business_type": "footwear", "license_number": f"LIC-{S}", "city": "Chennai",
    "preferred_language": "ta"})
check("2  Seller can register", ok(r) and r.json()["role"] == "seller" and r.json()["seller_id"], r.text)
SELLER, SELLER_ID = r.json()["access_token"], int(r.json()["seller_id"])

r = req("POST", "/auth/register", json={
    "email": f"courier-{S}@example.com", "password": "secret123", "role": "logistics", "full_name": "Test Courier",
    "company_name": f"Test Courier {S}", "service_city": "Chennai", "vehicle_type": "Bike", "vehicle_number": "TN01 X 1"})
check("3  Logistics partner can register", ok(r) and r.json()["role"] == "logistics" and r.json()["logistics_id"], r.text)
COURIER, COURIER_ID = r.json()["access_token"], int(r.json()["logistics_id"])

r = req("POST", "/auth/otp/request", json={"identifier": f"buyer-{S}@example.com"})
code = r.json().get("dev_code")
bad = req("POST", "/auth/otp/verify", json={"identifier": f"buyer-{S}@example.com", "code": "000000" if code != "000000" else "111111"})
good = req("POST", "/auth/otp/verify", json={"identifier": f"buyer-{S}@example.com", "code": code or ""})
check("   OTP login: wrong code rejected, right code logs in", ok(r) and bad.status_code == 422 and ok(good)
      and good.json()["role"] == "buyer", f"{r.text} {bad.text} {good.text}")

r = req("POST", "/auth/register", json={"email": f"other-{S}@example.com", "password": "secret123", "role": "buyer",
                                        "full_name": "Other Buyer"})
OTHER_BUYER = r.json()["access_token"]
r = req("POST", "/auth/register", json={"email": f"seller2-{S}@example.com", "password": "secret123", "role": "seller",
                                        "business_name": f"Other Store {S}", "business_type": "retail"})
OTHER_SELLER = r.json()["access_token"]
r = req("POST", "/auth/register", json={"email": f"courier2-{S}@example.com", "password": "secret123", "role": "logistics",
                                        "company_name": f"Other Courier {S}", "service_city": "Madurai"})
OTHER_COURIER = r.json()["access_token"]
ADMIN = req("POST", "/auth/demo-login", json={"demo": "admin"}).json()["access_token"]

# ─────────────────────────────── Seller catalogue ───────────────────────────────
section("Seller catalogue setup (products, variants, pricing, negotiation rules)")
def make_product(name, price, days, express, sizes, **extra):
    return req("POST", "/products", SELLER, json={
        "name": name, "description": f"{name} in black leather for college and office", "category": CAT,
        "price": price, "delivery_days": days, "express_available": express, "return_days": 10,
        "return_policy": "Unworn, within 10 days", "specifications": {"Sole": "Cushioned TPR", "Upper": "Leather"},
        "sku": f"{name[:3].upper()}-{S}", "variants": [{"size": s, "color": "Black", "stock": n} for s, n in sizes],
        **extra})

pa = make_product(f"Oxford {S}", 1299.0, 2, True, [("8", 5), ("9", 5), ("10", 5)])
pb = make_product(f"Derby {S}", 999.0, 4, False, [("9", 3)])
pc = make_product(f"Brogue {S}", 1399.0, 1, True, [("9", 2)], bulk_pricing=[{"min_qty": 2, "unit_price": 1350.0}])
check("   Seller adds products with variants, SKU, delivery + return info", all(ok(x, 201) for x in (pa, pb, pc))
      and len(pa.json()["variants"]) == 3 and pa.json()["stock"] == 15, pa.text)
A, B, C = pa.json(), pb.json(), pc.json()
VA9 = next(v["id"] for v in A["variants"] if v["size"] == "9")
VB9 = B["variants"][0]["id"]
VC9 = C["variants"][0]["id"]

for pid, rule in [(A["id"], {"min_price": 1150, "auto_accept_threshold": 1200, "max_rounds": 2, "counter_offer_range_pct": 10}),
                  (B["id"], {"min_price": 900, "max_rounds": 2}),
                  (C["id"], {"min_price": 1300, "max_rounds": 2,
                             "quantity_discount_rules": [{"min_qty": 2, "discount_pct": 5}]})]:
    r = req("PUT", f"/negotiation/products/{pid}/rule", SELLER, json={"enabled": True, **rule})
check("   Seller sets negotiation rules (floor, auto-accept, rounds, counter range, qty discount)", ok(r), r.text)

# ─────────────────────────────── Search ───────────────────────────────
section("4-7 Search, natural language, voice, Tamil/Tanglish")
r = req("GET", f"/discover?q=Oxford {S}&sort=price_asc&min_price=100&budget=5000&in_stock=true")
check("4  Buyer can search normally (keyword + filters + sort)", ok(r) and any(i["id"] == A["id"] for i in r.json()["items"]), r.text)
r = req("GET", f"/discover?category={CAT}&sort=price_asc")
prices = [i["price"] for i in r.json()["items"]]
check("   Catalogue sorting by price works", ok(r) and prices == sorted(prices) and len(prices) == 3, str(prices))
r = req("GET", f"/discover?category={CAT}&size=10")
check("   Size filter only returns products with that size in stock", ok(r) and [i["id"] for i in r.json()["items"]] == [A["id"]], r.text)
r = req("GET", f"/discover?category={CAT}&max_delivery_days=2")
check("   Delivery filter works", ok(r) and {i["id"] for i in r.json()["items"]} == {A["id"], C["id"]}, r.text)

r = req("GET", "/discover/natural", params={"q": "comfortable black formal shoes under 1500"})
body = r.json() if ok(r) else {}
filters = body.get("interpreted", {}).get("filters", {})
check("5  Natural-language search → structured filters", ok(r) and filters.get("category") == "Footwear"
      and filters.get("budget") == 1500 and body["items"] and all(i["price"] <= 1500 for i in body["items"]), r.text)

r = req("POST", "/assistant/voice", BUYER, json={"text": "I need black formal shoes under 1500", "source_language": "en"})
v = r.json() if ok(r) else {}
check("6  Buyer can use voice (transcript → action → spoken reply)", ok(r) and v.get("spoken_reply")
      and v.get("recommendations") and v.get("intent") == "search", r.text)

r = req("POST", "/assistant/voice", BUYER, json={"text": "1500 kulla black formal shoe venum", "source_language": "en"})
v = r.json() if ok(r) else {}
r2 = req("POST", "/assistant/chat", BUYER, json={"message": "எனக்கு 1500 ரூபாய்க்குள் கருப்பு ஃபார்மல் ஷூ வேண்டும்", "voice": True})
v2 = r2.json() if ok(r2) else {}
check("7  Understands Tanglish and Tamil, replies in that language", ok(r) and v.get("language") == "tanglish"
      and v.get("recommendations") and all(x["price"] <= 1500 for x in v["recommendations"])
      and ok(r2) and v2.get("language") == "ta" and v2.get("recommendations")
      and any("஀" <= ch <= "௿" for ch in v2.get("reply", "")), f"{r.text[:300]} | {r2.text[:300]}")

# ─────────────────────────────── Recommendations ───────────────────────────────
section("8-11 Recommendations, Why this?, questions, comparison")
r = req("GET", f"/recommendation?category={CAT}&budget=1500", BUYER)
items = r.json().get("items", []) if ok(r) else []
tags = [i["tag"] for i in items]
check("8  Recommends 2-3 relevant products with distinct tags", ok(r) and 2 <= len(items) <= 3
      and "Best Fit" in tags and len(set(tags)) == len(tags), r.text)
check("9  Every pick explains WHY (truthful reasons + 'see more')", items and all(i["reasons"] for i in items)
      and all(("Within your budget" not in " ".join(i["reasons"])) or i["price"] <= 1500 for i in items)
      and any(i["more_reasons"] for i in items), str(items)[:400])

ctx = {"product_ids": [A["id"], B["id"], C["id"]], "current_product_id": A["id"]}
r = req("POST", "/assistant/chat", BUYER, json={"message": "Is size 9 available?", "context": ctx})
q1 = r.json() if ok(r) else {}
r = req("POST", "/assistant/chat", BUYER, json={"message": "What is the sole made of?", "context": ctx})
q2 = r.json() if ok(r) else {}
check("10 Buyer can ask product questions (stock/size + product facts)", q1.get("intent") == "check_availability"
      and "available" in q1.get("reply", "").lower() and q2.get("intent") == "product_question" and q2.get("reply"),
      f"{q1} | {q2}")

r = req("POST", "/recommendation/compare", BUYER, json={"product_ids": [A["id"], B["id"]]})
cmp_ = r.json() if ok(r) else {}
check("11 Buyer can compare (price, delivery, quality, reliability, availability + summary)", ok(r)
      and cmp_.get("summary") and len(cmp_.get("table", [])) == 2 and cmp_.get("differences")
      and all({"delivery_days", "rating", "trust_score", "stock"} <= set(row) for row in cmp_["table"]), r.text)

r = req("POST", "/assistant/chat", BUYER, json={"message": "show something cheaper", "context": {"product_ids": [C["id"], A["id"]]}})
ch = r.json() if ok(r) else {}
check("   Assistant: 'show something cheaper' returns cheaper options", ch.get("intent") == "cheaper"
      and ch.get("recommendations") and all(x["price"] < 1299 for x in ch["recommendations"]), r.text[:400])
r = req("POST", "/assistant/chat", BUYER, json={"message": "Can I get this tomorrow?", "context": ctx})
check("   Assistant: 'can I get this tomorrow' checks delivery", ok(r) and r.json()["intent"] == "delivery_estimate"
      and "tomorrow" in r.json()["reply"].lower(), r.text[:300])
r = req("POST", "/assistant/chat", BUYER, json={"message": "Can I get it for 1000?", "context": {"product_ids": [C["id"]], "current_product_id": C["id"]}})
ng = r.json() if ok(r) else {}
check("   Assistant: bargaining proposes an offer but never sends it", ng.get("intent") == "negotiate"
      and any(a["type"] == "send_offer" for a in ng.get("actions", []))
      and not req("GET", f"/negotiation/products/{C['id']}/thread", BUYER).json(), r.text[:400])

# ─────────────────────────────── Negotiation ───────────────────────────────
section("12-14 Negotiation")
r = req("GET", f"/negotiation/products/{A['id']}/suggestion?desired_price=1000", BUYER)
sug = r.json() if ok(r) else {}
check("12 Buyer can negotiate: '₹1000 is outside the range — try ₹1150?'", sug.get("within_range") is False
      and sug.get("suggested_price") == 1150 and "outside" in (sug.get("message") or ""), r.text)

above = req("POST", "/negotiation/offers", BUYER, json={"product_id": A["id"], "quantity": 1, "offered_price": 1500})
r = req("POST", "/negotiation/offers", BUYER, json={"product_id": A["id"], "quantity": 1, "offered_price": 1050})
thread = req("GET", f"/negotiation/products/{A['id']}/thread", BUYER).json()
counter = next((o for o in thread if o["offered_by"] == "seller" and o["status"] == "pending"), None)
r2 = req("POST", f"/negotiation/offers/{counter['id']}/respond", BUYER, json={"action": "accept"}) if counter else None
r3 = req("POST", "/negotiation/offers", BUYER, json={"product_id": A["id"], "quantity": 1, "offered_price": 1210})
r4 = req("POST", "/negotiation/offers", BUYER, json={"product_id": A["id"], "quantity": 1, "offered_price": 1220})
check("13 Seller rules work (above-list rejected, auto-counter in range, auto-accept, round limit)",
      above.status_code == 422 and ok(r) and r.json()["status"] == "countered" and counter and counter["offered_price"] == 1150
      and r2 is not None and r2.json()["status"] == "accepted" and ok(r3) and r3.json()["status"] == "accepted"
      and r4.status_code == 422, f"{above.text} {r.text} {thread} {r3.text} {r4.text}")
A_OFFER = counter["id"] if counter else None

o1 = req("POST", "/negotiation/offers", BUYER, json={"product_id": B["id"], "quantity": 1, "offered_price": 920})
rej = req("POST", f"/negotiation/offers/{o1.json()['id']}/respond", SELLER, json={"action": "reject"})
o2 = req("POST", "/negotiation/offers", BUYER, json={"product_id": B["id"], "quantity": 1, "offered_price": 950})
ctr = req("POST", f"/negotiation/offers/{o2.json()['id']}/respond", SELLER, json={"action": "counter", "counter_price": 975})
low_ctr = req("POST", f"/negotiation/offers/{o2.json()['id']}/respond", SELLER, json={"action": "counter", "counter_price": 800})
acc = req("POST", f"/negotiation/offers/{ctr.json()['id']}/respond", BUYER, json={"action": "accept"})
o3 = req("POST", "/negotiation/offers", BUYER, json={"product_id": C["id"], "quantity": 1, "offered_price": 1350})
sacc = req("POST", f"/negotiation/offers/{o3.json()['id']}/respond", SELLER, json={"action": "accept"})
wrong_side = req("POST", f"/negotiation/offers/{o3.json()['id']}/respond", OTHER_SELLER, json={"action": "accept"})
check("14 Seller can accept / reject / counter", ok(rej) and rej.json()["status"] == "rejected"
      and ok(ctr) and ctr.json()["offered_price"] == 975 and ok(acc) and acc.json()["status"] == "accepted"
      and ok(sacc) and sacc.json()["status"] == "accepted" and wrong_side.status_code in (403, 422),
      f"{rej.text} {ctr.text} {acc.text} {sacc.text}")
qd = req("GET", f"/negotiation/products/{C['id']}/suggestion?quantity=2&desired_price=1240", BUYER).json()
check("   Quantity discount lowers the floor for bulk buyers", qd.get("within_range") is True, str(qd))

# ─────────────────────────────── Communication ───────────────────────────────
section("15-16 Buyer ↔ seller communication and translation")
req("PATCH", "/auth/me/language", BUYER, json={"preferred_language": "en"})
r = req("POST", "/conversations", BUYER, json={"seller_id": SELLER_ID})
convo_id = r.json().get("id")
m = req("POST", f"/conversations/{convo_id}/messages", BUYER, json={"content": "Is the Oxford available in size 9 black?",
                                                                    "client_message_id": f"m-{S}"})
v_ = req("POST", f"/conversations/{convo_id}/messages", SELLER, json={"content": "ஆம், சைஸ் 9 கிடைக்கும்",
                                                                     "message_type": "voice", "client_message_id": f"v-{S}"})
seen = req("GET", f"/conversations/{convo_id}/messages?limit=10", SELLER).json().get("items", [])
check("15 Buyer and seller can communicate (text + voice messages)", ok(r) and ok(m) and ok(v_)
      and v_.json()["message_type"] == "voice" and any(x["content"].startswith("Is the Oxford") for x in seen),
      f"{r.text} {m.text} {v_.text}")
translated = None
for _ in range(20):
    time.sleep(1)
    items_ = req("GET", f"/conversations/{convo_id}/messages?limit=10", SELLER).json().get("items", [])
    hit = next((x for x in items_ if x["id"] == m.json()["id"]), {})
    if hit.get("translated_content"):
        translated = hit
        break
check("16 Communication is translated (buyer EN → seller TA)", translated is not None
      and translated.get("translated_language") == "ta"
      and any("஀" <= ch <= "௿" for ch in translated.get("translated_content", "")), str(translated))

# ─────────────────────────────── Cart & checkout ───────────────────────────────
section("17-21 Cart, checkout, payment, seller order, inventory")
no_variant = req("POST", "/cart/items", BUYER, json={"product_id": A["id"], "quantity": 1})
offer_line = req("POST", "/cart/items", BUYER, json={"offer_id": A_OFFER, "variant_id": VA9})
plain_line = req("POST", "/cart/items", BUYER, json={"product_id": B["id"], "variant_id": VB9, "quantity": 1})
cart = req("GET", "/cart", BUYER).json()
neg = next((i for i in cart.get("items", []) if i["product_id"] == A["id"]), {})
check("17 Buyer can add to cart (variant required, negotiated price, discounts, delivery, total)",
      no_variant.status_code == 422 and ok(offer_line) and ok(plain_line) and neg.get("unit_price") == 1150
      and neg.get("price_reason") == "negotiated" and cart["discount_total"] == 149 and "delivery_total" in cart
      and cart["total"] == cart["items_total"] + cart["delivery_total"], str(cart)[:500])

addr = req("POST", "/buyers/me/addresses", BUYER, json={"label": "Home", "line1": "12 Anna Salai", "city": "Chennai",
                                                       "state": "Tamil Nadu", "postal_code": "600002", "country": "India",
                                                       "is_default": True}).json()
ADDR = addr["id"]
r = req("POST", "/cart/checkout", BUYER, json={"address_id": ADDR, "payment_method": "netbanking",
                                               "delivery_option": "standard"})
orders = r.json() if r.status_code == 201 else []
ORDER = orders[0] if orders else {}
check("18 Buyer can checkout (address, delivery option, payment, summary)", r.status_code == 201 and len(orders) == 1
      and ORDER["total_amount"] == 1150 + 999 + ORDER["delivery_charge"] and ORDER.get("expected_delivery")
      and len(ORDER["items"]) == 2 and not req("GET", "/cart", BUYER).json()["items"], r.text[:500])
OID = ORDER.get("id")

pay = req("GET", f"/payments/orders/{OID}", BUYER).json()
cod = req("POST", "/orders", BUYER, json={"items": [{"product_id": C["id"], "variant_id": VC9, "quantity": 1}],
                                          "address_id": ADDR, "payment_method": "cod"})
cod_pay = req("GET", f"/payments/orders/{cod.json().get('id')}", BUYER).json()
check("19 Payment status is recorded (prepaid completed, COD pending)", pay.get("status") == "completed"
      and cod.status_code == 201 and cod.json()["status"] == "payment_pending" and cod_pay.get("status") == "pending",
      f"{pay} {cod.text[:200]} {cod_pay}")

seller_orders = req("GET", "/orders?group=active", SELLER).json()["items"]
seller_notes = req("GET", "/notifications", SELLER).json()
check("20 Seller receives the order (list + 'New order' notification)", any(o["id"] == OID for o in seller_orders)
      and any(n["type"] == "order_confirmed" for n in seller_notes), str(seller_notes)[:300])

inv = {(r_["product_id"], r_["variant_id"]): r_ for r_ in req("GET", "/inventory", SELLER).json()["items"]}
a9, c9 = inv[(A["id"], VA9)], inv[(C["id"], VC9)]
cancel = req("POST", f"/orders/{cod.json()['id']}/cancel", SELLER, json={"reason": "Out of gift boxes"})
c9_after = {(x["product_id"], x["variant_id"]): x for x in req("GET", "/inventory", SELLER).json()["items"]}[(C["id"], VC9)]
check("21 Inventory updated correctly (reserved on order, released on cancel)",
      a9["available_to_sell"] == 4 and a9["reserved"] == 1 and a9["on_hand"] == 5
      and c9["reserved"] == 1 and ok(cancel) and c9_after["reserved"] == 0 and c9_after["available_to_sell"] == 2,
      f"{a9} {c9} {c9_after}")

# ─────────────────────────────── Fulfilment & logistics ───────────────────────────────
section("22-31 Packing, shipment, logistics, tracking, proof of delivery")
jump = req("PATCH", f"/orders/{OID}/status", SELLER, json={"status": "picked_up"})
steps = [req("PATCH", f"/orders/{OID}/status", SELLER, json={"status": s}) for s in ("seller_confirmed", "processing", "packed")]
check("22 Seller can confirm and pack (and can't mark pickup themselves)", jump.status_code in (403, 422)
      and all(ok(x) for x in steps) and steps[-1].json()["status"] == "packed", jump.text)

early_ship = None
r = req("POST", "/shipments", SELLER, json={"order_id": OID, "package_count": 1, "weight_kg": 1.2, "length_cm": 32,
                                            "width_cm": 20, "height_cm": 12, "logistics_partner_id": COURIER_ID})
SHIP = r.json() if r.status_code == 201 else {}
label = req("GET", f"/shipments/{SHIP.get('id')}/label", SELLER)
order_now = req("GET", f"/orders/{OID}", BUYER).json()
check("23 Shipment can be created (package details, partner, label)", r.status_code == 201
      and SHIP["status"] == "pickup_assigned" and ok(label) and label.json()["to"]["address"]
      and order_now["status"] == "ready_for_pickup", r.text[:400])

pickups = req("GET", "/shipments?view=pickups", COURIER).json()
dash = req("GET", "/logistics/dashboard", COURIER).json()
courier_notes = req("GET", "/notifications", COURIER).json()
check("24 Logistics partner receives the shipment (pickups, dashboard, notification)",
      any(s["id"] == SHIP.get("id") for s in pickups) and dash.get("assigned_pickups", 0) >= 1
      and any(n["type"] == "pickup_assigned" for n in courier_notes), f"{pickups} {dash}")

acc_ = req("POST", f"/shipments/{SHIP['id']}/accept", COURIER)
pk = req("POST", f"/shipments/{SHIP['id']}/status", COURIER, json={"status": "picked_up", "location": "Chennai seller hub"})
a9_after = {(x["product_id"], x["variant_id"]): x for x in req("GET", "/inventory", SELLER).json()["items"]}[(A["id"], VA9)]
check("25 Logistics partner can accept and pick up (order → PICKED_UP, stock leaves reserve)", ok(acc_) and ok(pk)
      and req("GET", f"/orders/{OID}", BUYER).json()["status"] == "picked_up" and a9_after["reserved"] == 0,
      f"{acc_.text[:200]} {pk.text[:200]} {a9_after}")

steps2 = [req("POST", f"/shipments/{SHIP['id']}/status", COURIER, json={"status": s, "location": loc})
          for s, loc in (("at_hub", "Guindy hub"), ("in_transit", "Guindy → T Nagar"), ("out_for_delivery", "T Nagar"))]
loc = req("POST", f"/shipments/{SHIP['id']}/location", COURIER, json={"location": "Near Anna Salai"})
buyer_view = req("GET", f"/shipments/by-order/{OID}", BUYER).json()
seller_view = req("GET", f"/shipments/by-order/{OID}", SELLER).json()
check("26 Tracking updates appear to buyer and seller", all(ok(x) for x in steps2) and ok(loc)
      and buyer_view["current_location"] == "Near Anna Salai" and len(buyer_view["events"]) >= 6
      and len(seller_view["events"]) == len(buyer_view["events"]), str(buyer_view)[:400])

mine = req("GET", "/orders?group=active", BUYER).json()["items"]
mo = next((o for o in mine if o["id"] == OID), {})
check("27 Buyer sees My Orders (product, variant, seller, amount, status, estimate)", mo
      and mo["items"][0]["product_name"] and any(i["variant_label"] for i in mo["items"]) and mo["seller_name"]
      and mo["status"] == "out_for_delivery" and mo["expected_delivery"], str(mo)[:400])

detail = req("GET", f"/orders/{OID}", BUYER).json()
tracking = req("GET", f"/orders/{OID}/tracking", BUYER).json()
statuses = [e["status"] for e in tracking]
check("28 Buyer can track the order (timeline with timestamps, shipment, OTP)", detail.get("shipment")
      and detail.get("delivery_otp") and all(e["created_at"] for e in tracking)
      and statuses[:1] == ["paid"] and "picked_up" in statuses and "out_for_delivery" in statuses, str(statuses))

OTP = detail.get("delivery_otp") or ""
wrong = req("POST", f"/shipments/{SHIP['id']}/deliver", COURIER, json={"otp": "999999" if OTP != "999999" else "111111",
                                                                      "signature_name": "Test Buyer"})
dlv = req("POST", f"/shipments/{SHIP['id']}/deliver", COURIER, json={"otp": OTP, "signature_name": "Test Buyer",
                                                                    "photo_url": "https://example.com/pod.jpg"})
check("29 Logistics partner can mark delivery (wrong OTP refused)", wrong.status_code == 422 and ok(dlv), dlv.text[:300])
pod = dlv.json().get("proof_of_delivery") or {}
check("30 Proof of delivery recorded (OTP, signature, photo, time)", pod.get("otp_verified") is True
      and pod.get("signature_name") == "Test Buyer" and pod.get("photo_url") and pod.get("recorded_at"), str(pod))
final = req("GET", f"/orders/{OID}", BUYER).json()
seller_pay = req("GET", "/sellers/payments", SELLER).json()
row = next((x for x in seller_pay["items"] if x["order_id"] == OID), {})
check("31 Order becomes DELIVERED (shipment and order; payout scheduled)", final["status"] == "delivered"
      and dlv.json()["status"] == "delivered" and row.get("settlement_status") == "scheduled", f"{final['status']} {row}")

# ─────────────────────────────── After delivery ───────────────────────────────
section("32-34 Notifications, reorder, personalisation")
notes = req("GET", "/notifications", BUYER).json()
types = {n["type"] for n in notes}
unread = req("GET", "/notifications/unread-count", BUYER).json()["count"]
mark = req("POST", "/notifications/read-all", BUYER)
check("32 Buyer receives notifications (confirmed, paid, shipped, out for delivery, delivered)",
      {"order_confirmed", "payment_successful", "shipment_created", "order_out_for_delivery", "order_delivered"} <= types
      and unread > 0 and ok(mark) and req("GET", "/notifications/unread-count", BUYER).json()["count"] == 0, str(types))

re_ = req("POST", f"/orders/{OID}/reorder", BUYER, json={"add_to_cart": True})
cart2 = req("GET", "/cart", BUYER).json()
chat_re = req("POST", "/assistant/chat", BUYER, json={"message": "buy again"}).json()
check("33 Buyer can reorder (same items/variants prefilled into cart)", ok(re_) and re_.json()["added_to_cart"] == 2
      and {(i["product_id"], i["variant_id"]) for i in cart2["items"]} == {(A["id"], VA9), (B["id"], VB9)}
      and re_.json()["address_id"] == ADDR and chat_re.get("intent") == "reorder", re_.text[:300])

pers = req("GET", "/buyers/me/personalisation", BUYER).json()
home = req("GET", "/buyers/me/home", BUYER).json()
und = req("POST", "/assistant/understand", BUYER, json={"text": f"{CAT} for office"}).json()
check("34 Personalisation for returning users (remembers size 9, home Buy Again, applies size)",
      pers.get("learned", {}).get("sizes", {}).get(CAT) == "9" and home.get("is_returning")
      and any(b["product_id"] == A["id"] for b in home.get("buy_again", []))
      and any("size 9" in h for h in home.get("hints", []))
      and (und.get("extraction") or {}).get("applied_size") == "9", f"{pers} | {home.get('hints')} | {und.get('extraction')}")
prefs = req("PUT", "/buyers/me/preferences", BUYER, json={"privacy_settings": {"personalisation": False}})
off = req("GET", "/buyers/me/personalisation", BUYER).json()
req("PUT", "/buyers/me/preferences", BUYER, json={"privacy_settings": {"personalisation": True}})
check("   Buyer controls personalisation (switching it off stops using history)", ok(prefs) and off["learned"] is None, str(off)[:200])

# ─────────────────────────────── Security ───────────────────────────────
section("35 Role-based security")
denials = {
    "other seller can't adjust this seller's inventory":
        req("POST", "/inventory/adjust", OTHER_SELLER, json={"product_id": A["id"], "variant_id": VA9, "delta": 5}).status_code,
    "other seller can't edit this seller's product":
        req("PUT", f"/products/{A['id']}", OTHER_SELLER, json={"price": 1}).status_code,
    "unassigned courier can't see the shipment": req("GET", f"/shipments/{SHIP['id']}", OTHER_COURIER).status_code,
    "unassigned courier can't move the shipment":
        req("POST", f"/shipments/{SHIP['id']}/status", OTHER_COURIER, json={"status": "at_hub"}).status_code,
    "buyer can't see another buyer's order": req("GET", f"/orders/{OID}", OTHER_BUYER).status_code,
    "buyer can't change order status": req("PATCH", f"/orders/{OID}/status", BUYER, json={"status": "delivered"}).status_code,
    "non-admin can't open admin dashboard": req("GET", "/admin/dashboard", SELLER).status_code,
    "seller can't verify their own store":
        req("PATCH", f"/sellers/profile/status?profile_id={SELLER_ID}", SELLER, json={"status": "verified"}).status_code,
    "stranger can't read a buyer profile": req("GET", "/buyers/1").status_code,
    "stranger can't read seller revenue": req("GET", f"/analytics/{SELLER_ID}").status_code,
    "anonymous can't use the AI assistant": req("POST", "/assistant/chat", json={"message": "hi"}).status_code,
}
bad_ = {k: v for k, v in denials.items() if v not in (401, 403)}
check("35 Role-based security prevents unauthorised access", not bad_, str(bad_))

# ─────────────────────────────── Returns, disputes, admin ───────────────────────────────
section("Returns, disputes, settlements, admin, seller hub")
r = req("POST", "/cart/checkout", BUYER, json={"address_id": ADDR, "payment_method": "upi"})
O2 = r.json()[0]["id"] if r.status_code == 201 else None
for s_ in ("seller_confirmed", "processing", "packed"):
    req("PATCH", f"/orders/{O2}/status", SELLER, json={"status": s_})
sh2 = req("POST", "/shipments", SELLER, json={"order_id": O2, "logistics_partner_id": COURIER_ID}).json()
for s_ in ("picked_up", "in_transit", "out_for_delivery"):
    req("POST", f"/shipments/{sh2['id']}/status", COURIER, json={"status": s_})
otp2 = req("GET", f"/orders/{O2}", BUYER).json().get("delivery_otp")
req("POST", f"/shipments/{sh2['id']}/deliver", COURIER, json={"otp": otp2, "signature_name": "Test Buyer"})
b9_before = {(x["product_id"], x["variant_id"]): x for x in req("GET", "/inventory", SELLER).json()["items"]}[(B["id"], VB9)]
ret = req("POST", f"/orders/{O2}/return", BUYER, json={"reason": "Size runs small"})
back = req("PATCH", f"/orders/{O2}/status", SELLER, json={"status": "returned"})
refund = req("PATCH", f"/orders/{O2}/status", SELLER, json={"status": "refunded"})
b9_after = {(x["product_id"], x["variant_id"]): x for x in req("GET", "/inventory", SELLER).json()["items"]}[(B["id"], VB9)]
check("   Return → returned (restocked) → refunded", ok(ret) and ret.json()["status"] == "return_requested"
      and ok(back) and ok(refund) and req("GET", f"/payments/orders/{O2}", BUYER).json()["status"] == "refunded"
      and b9_after["available_to_sell"] == b9_before["available_to_sell"] + 1, f"{ret.text[:200]} {back.text[:200]} {refund.text[:200]}")

settle = req("POST", "/admin/settlements/run", ADMIN)
row = next(x for x in req("GET", "/sellers/payments", SELLER).json()["items"] if x["order_id"] == OID)
check("   Admin runs settlements → seller payout settled (net of platform fee)", ok(settle)
      and row["settlement_status"] == "settled" and row["net_amount"] == round(row["total_paid"] - row["platform_fee"], 2), str(row))

d = req("POST", "/disputes", BUYER, json={"order_id": OID, "reason": "damaged", "description": "Sole came off"})
dup = req("POST", "/disputes", BUYER, json={"order_id": OID, "reason": "damaged"})
res = req("PATCH", f"/disputes/{d.json().get('id')}", ADMIN, json={"status": "resolved", "resolution": "Refunded in full", "refund": True})
check("   Dispute raised by buyer, resolved by admin with refund", d.status_code == 201 and dup.status_code == 422
      and ok(res) and req("GET", f"/orders/{OID}", BUYER).json()["status"] == "refunded"
      and req("GET", f"/payments/orders/{OID}", BUYER).json()["status"] == "refunded", f"{d.text[:200]} {res.text[:200]}")

inspect = req("GET", f"/admin/orders/{OID}", ADMIN).json()
check("   Admin inspects order: buyer, seller, payment, shipment, tracking, chat, disputes",
      all(inspect.get(k) for k in ("buyer", "seller_name", "payment", "shipment", "tracking", "shipment_events", "disputes"))
      and isinstance(inspect.get("communication"), list) and inspect["communication"], str(list(inspect))[:300])

dash = req("GET", "/admin/dashboard", ADMIN).json()
check("   Admin dashboard (buyers, sellers, orders, revenue, shipments, verification, disputes, alerts)",
      all(k in dash for k in ("total_buyers", "total_sellers", "active_sellers", "orders", "revenue",
                              "active_shipments", "pending_verification", "disputes", "alerts")), str(dash)[:300])

other_id = next(u["id"] for u in req("GET", f"/admin/users?q=other-{S}", ADMIN).json())
sus = req("PATCH", f"/admin/users/{other_id}", ADMIN, json={"is_active": False})
blocked = req("POST", "/auth/login", json={"identifier": f"other-{S}@example.com", "password": "secret123"})
react = req("PATCH", f"/admin/users/{other_id}", ADMIN, json={"is_active": True})
check("   Admin suspends / reactivates users (suspended can't log in)", ok(sus) and blocked.status_code == 403
      and ok(react), blocked.text)

req("PUT", "/sellers/profile", SELLER, json={"phone": "9876543210", "bank_account_holder": "Test Seller",
                                              "bank_account_number": "123456789012", "bank_ifsc": "HDFC0001234",
                                              "upi_id": "testseller@okhdfc"})
sub = req("POST", "/sellers/profile/submit", SELLER)
info = req("PATCH", f"/admin/sellers/{SELLER_ID}/verification", ADMIN, json={"decision": "request_info", "note": "Upload GST certificate"})
resub = req("POST", "/sellers/profile/submit", SELLER)
appr = req("PATCH", f"/admin/sellers/{SELLER_ID}/verification", ADMIN, json={"decision": "approve", "note": "All good"})
me = req("GET", "/auth/me", SELLER).json()["seller"]
check("   Seller verification: submit → request info → resubmit → approve (bank stored as last 4)",
      ok(sub) and ok(info) and info.json()["verification_status"] == "draft" and ok(resub) and ok(appr)
      and me["verification_status"] == "verified" and me["bank_account_last4"] == "9012", f"{sub.text[:150]} {info.text[:150]} {me}")

rep = req("POST", f"/products/{B['id']}/report", OTHER_BUYER, json={"reason": "Counterfeit brand"})
reports = req("GET", "/admin/reports", ADMIN).json()
rid = next((x["id"] for x in reports if x["product_id"] == B["id"]), None)
rm = req("PATCH", f"/admin/reports/{rid}", ADMIN, json={"status": "resolved", "note": "Removed", "remove_product": True})
gone = req("GET", f"/discover?q=Derby {S}").json()["items"]
check("   Product reported → admin removes it → hidden from catalogue", rep.status_code == 201 and rid and ok(rm)
      and not gone and req("GET", f"/products/{B['id']}").status_code == 404, f"{rep.text} {rm.text}")

cat = req("POST", "/admin/categories", ADMIN, json={"name": f"Stationery {S}", "icon": "edit"})
cats = req("GET", "/categories").json()
check("   Admin manages categories (shown to buyers)", cat.status_code == 201
      and any(c["name"] == f"Stationery {S}" for c in cats), cat.text)
req("DELETE", f"/admin/categories/{cat.json()['id']}", ADMIN)

st = req("PUT", "/admin/settings", ADMIN, json={"standard_delivery_fee": 40})
an = req("GET", "/admin/analytics", ADMIN).json()
check("   Admin settings + analytics", ok(st) and "orders_by_status" in an and "negotiation_acceptance_rate" in an, str(an)[:200])

sd = req("GET", "/sellers/dashboard", SELLER).json()
ins = req("GET", "/sellers/insights", SELLER).json()
cus = req("GET", "/sellers/customers", SELLER).json()
check("   Seller dashboard, insights and customers use real data",
      all(k in sd for k in ("todays_orders", "pending_orders", "revenue_today", "low_stock", "shipments",
                            "negotiation_requests", "customer_messages", "alerts"))
      and {"revenue", "orders", "daily", "top_products", "buyer_sentiment"} <= set(ins)
      and any(c["name"] == "Test Buyer" and c["has_conversation"] for c in cus), f"{sd} {ins} {cus}")

arc = req("DELETE", f"/products/{A['id']}", SELLER)
check("   Seller delete archives a product that has orders", ok(arc) and arc.json()["archived"] is True, arc.text)

# ─────────────────────────────── Summary ───────────────────────────────
passed = sum(1 for _, ok_, _ in results if ok_)
failed = [(label, detail) for label, ok_, detail in results if not ok_]
prd = [r_ for r_ in results if r_[0][:2].strip().isdigit()]
print(f"\nPRD §71 scenarios: {sum(1 for r_ in prd if r_[1])}/{len(prd)} passed")
print(f"RESULT: {passed} passed, {len(failed)} failed")
sys.exit(1 if failed else 0)
