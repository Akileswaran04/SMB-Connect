"""Checks for the shop-owner-friendly auth changes. Needs the backend on :8010.
Run: .venv/Scripts/python.exe tests/test_easy_onboarding.py"""
import random

import httpx

from app.core.config import settings

BASE = "http://127.0.0.1:8010/api/v1"
c = httpx.Client(timeout=30)

# 1. A seller can sign up with only a mobile number (no email), then log in with it.
phone = "9" + "".join(random.choices("0123456789", k=9))
r = c.post(f"{BASE}/auth/register", json={"password": "secret123", "role": "seller", "phone": phone,
                                           "full_name": "Ravi Kumar", "business_name": "Ravi Stores", "preferred_language": "hi"})
assert r.status_code in (200, 201), r.text
r = c.post(f"{BASE}/auth/login", json={"identifier": phone, "password": "secret123"})
assert r.status_code == 200, r.text
token = r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")
me = c.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
seller = me.get("seller") or {}
assert not (seller.get("email") or "").endswith("@mobile.invalid"), "placeholder email leaked into the shop profile"

# 2. Same mobile again is refused with a plain message.
r = c.post(f"{BASE}/auth/register", json={"password": "secret123", "role": "buyer", "phone": phone, "full_name": "X"})
assert r.status_code == 409 and "mobile" in r.json()["detail"].lower(), r.text

# 3. No email and no mobile is refused.
r = c.post(f"{BASE}/auth/register", json={"password": "secret123", "role": "buyer", "full_name": "X"})
assert r.status_code >= 400, r.text

# 4. Demo login follows DEMO_LOGIN_ENABLED.
r = c.post(f"{BASE}/auth/demo-login", json={"demo": "buyer1"})
assert (r.status_code == 200) == settings.DEMO_LOGIN_ENABLED, (r.status_code, settings.DEMO_LOGIN_ENABLED)

print("ok — mobile-only signup, duplicate mobile, missing contact, demo-login gate")
