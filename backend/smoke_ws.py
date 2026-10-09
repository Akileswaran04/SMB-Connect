import asyncio
import json
import sys
import uuid

import httpx
import websockets

BASE = "http://127.0.0.1:8010/api/v1"
WS = "ws://127.0.0.1:8010/ws/chat"
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


async def next_event(ws, name, attempts=6):
    """Background events (e.g. message:sentiment) can interleave, so skip
    frames until the expected event arrives."""
    frame = {}
    for _ in range(attempts):
        frame = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        if frame.get("event") == name:
            break
    return frame


async def ws_flow():
    print("== Phase 3: WebSocket realtime ==")
    seller = client.post(f"{BASE}/auth/register", json={
        "email": f"ws-seller-{suffix}@example.com", "password": "secret123",
        "role": "seller", "business_name": "WS Seller",
    }).json()
    buyer = client.post(f"{BASE}/auth/register", json={
        "email": f"ws-buyer-{suffix}@example.com", "password": "secret123",
        "role": "buyer", "first_name": "WS", "last_name": "Buyer",
    }).json()

    seller_token = seller["access_token"]
    buyer_token = buyer["access_token"]
    seller_id = int(seller["seller_id"])
    buyer_id = int(buyer["buyer_id"])

    convo = client.post(f"{BASE}/conversations", json={"buyer_id": buyer_id},
                        headers={"Authorization": f"Bearer {seller_token}"}).json()
    conversation_id = convo["id"]

    async with websockets.connect(f"{WS}?token={buyer_token}") as buyer_ws, \
               websockets.connect(f"{WS}?token={seller_token}") as seller_ws:

        await buyer_ws.send(json.dumps({"type": "join", "conversation_id": conversation_id}))
        await seller_ws.send(json.dumps({"type": "join", "conversation_id": conversation_id}))
        b_join = json.loads(await buyer_ws.recv())
        s_join = json.loads(await seller_ws.recv())
        check("both sides join", b_join.get("event") == "joined" and s_join.get("event") == "joined", str(b_join)[:120])

        await buyer_ws.send(json.dumps({
            "type": "send", "conversation_id": conversation_id,
            "content": "Real-time hello", "client_message_id": f"ws-{suffix}",
        }))
        ack = None
        for _ in range(4):
            frame = json.loads(await asyncio.wait_for(buyer_ws.recv(), timeout=10))
            if frame.get("event") == "ack":
                ack = frame
                break
        check("sender acked", ack is not None and ack["message"]["content"] == "Real-time hello", str(ack)[:150])

        delivered = json.loads(await asyncio.wait_for(seller_ws.recv(), timeout=10))
        check("recipient receives message", delivered.get("event") == "message:new" and delivered["message"]["content"] == "Real-time hello", str(delivered)[:150])

        await buyer_ws.send(json.dumps({"type": "typing", "conversation_id": conversation_id, "is_typing": True}))
        typing = await next_event(seller_ws, "typing")
        check("typing event delivered", typing.get("event") == "typing" and typing.get("is_typing") is True, str(typing)[:120])

        await seller_ws.send(json.dumps({"type": "join", "conversation_id": conversation_id, "last_received_sequence": 0}))
        sync = await next_event(seller_ws, "sync")
        check("reconnection gap sync", sync.get("event") == "sync" and len(sync.get("items", [])) >= 1, str(sync)[:150])

    check("messages persisted to Mongo", len(client.get(
        f"{BASE}/conversations/{conversation_id}/messages?limit=100",
        headers={"Authorization": f"Bearer {seller_token}"}).json().get("items", [])) >= 1)

    convos = client.get(f"{BASE}/conversations", headers={"Authorization": f"Bearer {seller_token}"}).json()
    check("conversation listed after WS messages", any(c["id"] == conversation_id for c in convos.get("items", [])))


async def admin_flow():
    print("== Phase 6: admin flow ==")
    from app.infrastructure.postgres.database import AsyncSessionLocal
    from app.modules.seller_profile.models import User  # noqa: F401
    from app.modules.buyer_profile.models import BuyerProfile  # noqa: F401 — registers relationship
    from app.core.security import hash_password

    async with AsyncSessionLocal() as db:
        u = User(email=f"admin-{suffix}@example.com", password_hash=hash_password("secret123"),
                 full_name="Admin", role="admin", is_active=True)
        db.add(u)
        await db.commit()
        await db.refresh(u)
        admin_id = u.id
    login = client.post(f"{BASE}/auth/login", json={"identifier": f"admin-{suffix}@example.com", "password": "secret123"})
    check("admin login", login.status_code == 200, login.text[:200])
    admin_token = login.json()["access_token"]

    seller = client.post(f"{BASE}/auth/register", json={
        "email": f"verif-seller-{suffix}@example.com", "password": "secret123",
        "role": "seller", "business_name": "Verify Co", "license_number": "LIC-XYZ",
    }).json()
    seller_id = int(seller["seller_id"])

    verifs = client.get(f"{BASE}/admin/verifications",
                        headers={"Authorization": f"Bearer {admin_token}"})
    check("admin lists verifications", verifs.status_code == 200, verifs.text[:200])
    check("no verification for a seller who didn't submit",
          not any(v.get("seller_id") == seller_id for v in verifs.json()))

    denied = client.get(f"{BASE}/admin/verifications", headers={"Authorization": f"Bearer {seller['access_token']}"})
    check("non-admin blocked from admin API", denied.status_code == 403, denied.text[:200])

    audit = client.get(f"{BASE}/admin/audit-logs", headers={"Authorization": f"Bearer {admin_token}"})
    check("admin lists audit logs", audit.status_code == 200, audit.text[:200])


async def main():
    await ws_flow()
    await admin_flow()
    print()
    print(f"RESULT: {passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)


asyncio.run(main())