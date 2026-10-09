import json
import sys
import time
import uuid

import httpx

BASE = "http://127.0.0.1:8010/api/v1"
client = httpx.Client(timeout=30.0)
suffix = uuid.uuid4().hex[:6]
passed, failed = 0, 0


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name}  {detail}")


def register(role, extra=None):
    payload = {
        "email": f"{role}-{suffix}@example.com",
        "password": "secret123",
        "role": role,
        "full_name": f"Test {role.title()}",
        **(extra or {}),
    }
    r = client.post(f"{BASE}/auth/register", json=payload)
    return r


print("== Phase 1: auth role branching ==")
sr = register("seller", {"business_name": "Smoke Seller Co", "business_type": "retail", "license_number": f"LIC-{suffix}"})
check("seller register 200", sr.status_code == 200, sr.text[:200])
seller_token = sr.json()["access_token"]
seller_id = sr.json().get("seller_id")

br = register("buyer", {"first_name": "Buyer", "last_name": "One", "city": "Chennai"})
check("buyer register 200", br.status_code == 200, br.text[:200])
buyer_token = br.json()["access_token"]
buyer_id = br.json().get("buyer_id")

r = client.post(f"{BASE}/auth/register", json={
    "email": f"dup-{suffix}@example.com", "password": "secret123", "role": "seller"})
r2 = client.post(f"{BASE}/auth/register", json={
    "email": f"dup-{suffix}@example.com", "password": "secret123", "role": "seller"})
check("duplicate email rejected 409", r2.status_code == 409, r2.text[:200])

login = client.post(f"{BASE}/auth/login", json={"identifier": f"buyer-{suffix}@example.com", "password": "secret123"})
check("buyer login 200 + role", login.status_code == 200 and login.json().get("role") == "buyer", login.text[:200])

me = client.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {buyer_token}"})
check("auth/me returns buyer profile", me.status_code == 200 and me.json().get("buyer") is not None, me.text[:200])

print("== Phase 1: buyer profile + products ==")
upd = client.put(f"{BASE}/buyers/me", json={"city": "Mumbai", "preferred_payment_method": "mock"},
                 headers={"Authorization": f"Bearer {buyer_token}"})
check("buyer profile update", upd.status_code == 200 and upd.json().get("city") == "Mumbai", upd.text[:200])

prod = client.post(f"{BASE}/products", json={
    "name": "Smoke Widget", "description": "A test product", "category": "electronics",
    "price": 250.0, "stock": 10, "low_stock_threshold": 2,
}, headers={"Authorization": f"Bearer {seller_token}"})
check("seller creates product", prod.status_code == 201, prod.text[:200])
product_id = prod.json().get("id")

print("== Phase 2: Mongo chat ==")
convo = client.post(f"{BASE}/conversations", json={"buyer_id": int(buyer_id)},
                    headers={"Authorization": f"Bearer {seller_token}"})
check("seller opens conversation with buyer", convo.status_code == 200, convo.text[:200])
conversation_id = convo.json().get("id")

convo2 = client.post(f"{BASE}/conversations", json={"buyer_id": int(buyer_id)},
                     headers={"Authorization": f"Bearer {seller_token}"})
check("same pair reuses conversation", convo2.status_code == 200 and convo2.json().get("id") == conversation_id, convo2.text[:200])

msg = client.post(f"{BASE}/conversations/{conversation_id}/messages", json={
    "content": "Hi, how much is the widget with bulk discount?",
    "client_message_id": f"cm-{suffix}",
}, headers={"Authorization": f"Bearer {buyer_token}"})
check("buyer sends message", msg.status_code == 200, msg.text[:300])
# Sentiment is enriched in the background after send — poll for it.
sentiment = None
for _ in range(10):
    time.sleep(0.5)
    listed = client.get(f"{BASE}/conversations/{msg.json().get('conversation_id')}/messages?limit=5",
                        headers={"Authorization": f"Bearer {buyer_token}"}).json().get("items", [])
    sentiment = next((m.get("sentiment") for m in listed if m.get("id") == msg.json().get("id")), None)
    if sentiment:
        break
check("sentiment attached", (sentiment or {}).get("intent") == "price_inquiry", str(sentiment)[:300])
seq = msg.json().get("sequence_number")

msg2 = client.post(f"{BASE}/conversations/{conversation_id}/messages", json={
    "content": "Hi, how much is the widget with bulk discount?",
    "client_message_id": f"cm-{suffix}",
}, headers={"Authorization": f"Bearer {buyer_token}"})
check("idempotent resend returns same message", msg2.json().get("id") == msg.json().get("id"), msg2.text[:200])

pages = client.get(f"{BASE}/conversations/{conversation_id}/messages?limit=1&cursor=",
                   headers={"Authorization": f"Bearer {seller_token}"})
check("cursor pagination works", pages.status_code == 200 and len(pages.json().get("items", [])) == 1, pages.text[:200])

convos = client.get(f"{BASE}/conversations", headers={"Authorization": f"Bearer {buyer_token}"})
check("buyer lists conversations", convos.status_code == 200 and len(convos.json().get("items", [])) == 1, convos.text[:200])

print("== Phase 4: human approval ==")
draft = client.post(f"{BASE}/conversations/{conversation_id}/drafts",
                    headers={"Authorization": f"Bearer {seller_token}"})
check("AI draft generated", draft.status_code == 200 and draft.json().get("status") == "pending", draft.text[:300])
draft_id = draft.json().get("id")

edit = client.put(f"{BASE}/ai/drafts/{draft_id}", json={"content": "Our price is 250 each; 10% off for 10+ units."},
                  headers={"Authorization": f"Bearer {seller_token}"})
check("seller edits draft", edit.status_code == 200 and "10% off" in edit.json().get("draft_content", ""), edit.text[:200])

sent = client.post(f"{BASE}/ai/drafts/{draft_id}/send", headers={"Authorization": f"Bearer {seller_token}"})
check("approved draft sent as seller message", sent.status_code == 200 and sent.json().get("message", {}).get("sender_type") == "seller", sent.text[:300])

print("== Phase 5: orders + payments ==")
order = client.post(f"{BASE}/orders", json={
    "items": [{"product_id": product_id, "quantity": 2}],
    "shipping_address": "12 Test St, Mumbai",
}, headers={"Authorization": f"Bearer {buyer_token}"})
check("buyer places order", order.status_code == 201, order.text[:300])
order_id = order.json().get("id")
check("order total computed", order.json().get("total_amount") == 500.0, order.text[:300])

pay = client.get(f"{BASE}/payments/orders/{order_id}", headers={"Authorization": f"Bearer {buyer_token}"})
check("mock payment recorded", pay.status_code == 200 and pay.json().get("status") == "completed", pay.text[:200])

prod_after = client.get(f"{BASE}/products/{product_id}")
check("stock decremented", prod_after.json().get("stock") == 8, prod_after.text[:200])

S = {"Authorization": f"Bearer {seller_token}"}
B = {"Authorization": f"Bearer {buyer_token}"}

jump = client.patch(f"{BASE}/orders/{order_id}/status", json={"status": "delivered"}, headers=S)
check("status jump paid -> delivered rejected", jump.status_code == 422, jump.text[:200])

early_review = client.post(f"{BASE}/orders/{order_id}/review", json={"rating": 5}, headers=B)
check("review before delivery rejected", early_review.status_code == 422, early_review.text[:200])

# Seller fulfils up to packing; a courier moves the parcel from pickup on.
courier = client.post(f"{BASE}/auth/register", json={
    "email": f"courier-{suffix}@example.com", "password": "secret123", "role": "logistics",
    "company_name": f"Smoke Courier {suffix}", "service_city": "Mumbai"}).json()
L = {"Authorization": f"Bearer {courier['access_token']}"}
walked = True
for step in ["seller_confirmed", "processing", "packed"]:
    st = client.patch(f"{BASE}/orders/{order_id}/status", json={"status": step}, headers=S)
    if st.status_code != 200 or st.json().get("status") != step:
        walked = False
        print(f"        step {step}: {st.status_code} {st.text[:200]}")
        break
seller_pickup = client.patch(f"{BASE}/orders/{order_id}/status", json={"status": "picked_up"}, headers=S)
check("seller can't mark a pickup (courier only)", seller_pickup.status_code in (403, 422), seller_pickup.text[:200])
ship = client.post(f"{BASE}/shipments", json={"order_id": order_id, "logistics_partner_id": int(courier["logistics_id"])},
                   headers=S).json()
for step in ["picked_up", "in_transit", "out_for_delivery"]:
    st = client.post(f"{BASE}/shipments/{ship.get('id')}/status", json={"status": step}, headers=L)
    walked = walked and st.status_code == 200
otp = client.get(f"{BASE}/orders/{order_id}", headers=B).json().get("delivery_otp")
done = client.post(f"{BASE}/shipments/{ship.get('id')}/deliver", json={"otp": otp, "signature_name": "Buyer One"}, headers=L)
walked = walked and done.status_code == 200
check("order walks the full lifecycle to delivered (seller → courier → OTP)",
      walked and client.get(f"{BASE}/orders/{order_id}", headers=B).json().get("status") == "delivered", done.text[:200])

tracking = client.get(f"{BASE}/orders/{order_id}/tracking", headers=B)
check("every transition logged as a tracking event",
      tracking.status_code == 200 and len(tracking.json()) == 9, tracking.text[:200])

bad = client.patch(f"{BASE}/orders/{order_id}/status", json={"status": "not-a-state"}, headers=S)
check("free-text status rejected", bad.status_code == 422, bad.text[:200])

review = client.post(f"{BASE}/orders/{order_id}/review", json={"rating": 5, "comment": "Great!"}, headers=B)
check("buyer reviews order", review.status_code == 200 and review.json().get("is_verified_purchase") is True, review.text[:300])

cod = client.post(f"{BASE}/orders", json={
    "items": [{"product_id": product_id, "quantity": 3}],
    "shipping_address": "12 Test St, Mumbai", "payment_method": "cod",
}, headers=B)
cod_id = cod.json().get("id")
check("COD order is payment_pending", cod.status_code == 201 and cod.json().get("status") == "payment_pending", cod.text[:200])
cod_pay = client.get(f"{BASE}/payments/orders/{cod_id}", headers=B)
check("COD payment not marked completed", cod_pay.json().get("status") == "pending", cod_pay.text[:200])
check("COD order took stock", client.get(f"{BASE}/products/{product_id}").json().get("stock") == 5)

cancel = client.patch(f"{BASE}/orders/{cod_id}/status", json={"status": "cancelled"}, headers=S)
check("seller cancels COD order", cancel.status_code == 200, cancel.text[:200])
check("cancel returns stock", client.get(f"{BASE}/products/{product_id}").json().get("stock") == 8)
again = client.patch(f"{BASE}/orders/{cod_id}/status", json={"status": "cancelled"}, headers=S)
check("double cancel rejected (no double restock)", again.status_code == 422
      and client.get(f"{BASE}/products/{product_id}").json().get("stock") == 8, again.text[:200])

print("== Phase 6: analytics + admin ==")
time.sleep(2)
anon_an = client.get(f"{BASE}/analytics/{seller_id}")
check("analytics require login", anon_an.status_code == 401, anon_an.text[:200])
buyer_an = client.get(f"{BASE}/analytics/{seller_id}", headers=B)
check("buyer blocked from seller analytics", buyer_an.status_code == 403, buyer_an.text[:200])
an = client.get(f"{BASE}/analytics/{seller_id}?force=true", headers=S)
check("analytics computed", an.status_code == 200 and an.json().get("total_orders") == 2, an.text[:300])
ts = client.get(f"{BASE}/analytics/{seller_id}/trust-score")
check("trust score computed", ts.status_code == 200 and ts.json().get("overall_score", 0) > 0, ts.text[:300])

print("== Phase 1: discovery search ==")
dis = client.get(f"{BASE}/discover?category=electronics&budget=500")
check("discovery search returns product", dis.status_code == 200 and len(dis.json().get("items", [])) >= 1, dis.text[:300])
check("trust badge in discovery", dis.json().get("items", [{}])[0].get("trust_score") is not None, dis.text[:300])

seller_pub = client.get(f"{BASE}/sellers/{seller_id}")
check("public seller profile", seller_pub.status_code == 200 and seller_pub.json().get("product_count") == 1, seller_pub.text[:200])

print("== RBAC ==")
other_payload = {
    "email": f"other-{suffix}@example.com",
    "password": "secret123",
    "role": "buyer",
    "first_name": "Other",
    "last_name": "Buyer",
}
other = client.post(f"{BASE}/auth/register", json=other_payload)
check("other buyer registers", other.status_code == 200, other.text[:200])
other_token = other.json()["access_token"]
steal = client.get(f"{BASE}/orders/{order_id}", headers={"Authorization": f"Bearer {other_token}"})
check("buyer blocked from other's order", steal.status_code == 403, steal.text[:200])
steal_msg = client.get(f"{BASE}/conversations/{conversation_id}/messages",
                       headers={"Authorization": f"Bearer {other_token}"})
check("non-participant blocked from chat", steal_msg.status_code == 403, steal_msg.text[:200])
anon_buyer = client.get(f"{BASE}/buyers/{buyer_id}")
check("buyer profile requires login", anon_buyer.status_code == 401, anon_buyer.text[:200])
peek = client.get(f"{BASE}/buyers/{buyer_id}", headers={"Authorization": f"Bearer {other_token}"})
check("other buyer blocked from buyer profile", peek.status_code == 403, peek.text[:200])
own_seller = client.get(f"{BASE}/buyers/{buyer_id}", headers={"Authorization": f"Bearer {seller_token}"})
check("seller the buyer ordered from can view profile", own_seller.status_code == 200, own_seller.text[:200])
anon_ai = client.post(f"{BASE}/assistant/understand", json={"text": "black shoes"})
check("AI assistant requires login", anon_ai.status_code == 401, anon_ai.text[:200])

print()
print(f"RESULT: {passed} passed, {failed} failed")
sys.exit(1 if failed else 0)