# TECHNOVA / MSME Connect

**AI-Powered Digital Business Ecosystem for MSMEs** — a full-fledged seller & buyer
marketplace with realtime chat, orders, payments, analytics and admin review.

## What's implemented

| Module | Status | Backing store |
|--------|--------|---------------|
| Authentication (single login, role at registration, JWT) | ✅ | PostgreSQL |
| **Temporary demo login** (2 sellers + 2 buyers, one-click) | ✅ | PostgreSQL |
| Seller Profile (business setup, verification, trust) | ✅ | PostgreSQL |
| Buyer Profile | ✅ | PostgreSQL |
| Product Listing (CRUD, inventory, low-stock alerts) | ✅ | PostgreSQL |
| Buyer Discovery (search/filter by category, location, budget) | ✅ | PostgreSQL + Redis cache |
| **Unified Inbox / Chat** (REST + WebSocket, cursor pagination, idempotent send, reconnection gap sync) | ✅ | **MongoDB** (messages/conversations) + **Redis** (pub/sub, presence, typing, unread) |
| AI Communication (sentiment/intent on every message) | ✅ | MongoDB |
| Human Approval (AI draft → seller review → send) | ✅ | MongoDB |
| **API Integration (Gmail / Outlook OAuth sync into the unified inbox)** | ✅ | PostgreSQL (`api_tokens`) + MongoDB |
| Orders + Payments + Transactions (ACID, mock payments, stock decrement) | ✅ | PostgreSQL |
| Analytics (background worker: response time, conversion, trust score) | ✅ | PostgreSQL |
| Admin (verification review, audit logs, RBAC) | ✅ | PostgreSQL |
| Rate limiting on auth endpoints (Redis fixed-window, fail-open) | ✅ | Redis |

## Database architecture

```
              FASTAPI BACKEND (modular monolith)
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   PostgreSQL          MongoDB            Redis
   (Neon cloud)        (Atlas cloud)      (Redis Cloud)
   ──────────          ─────────          ─────────
   users, profiles     conversations      presence/online
   products, orders    messages           typing indicators
   payments, reviews   ai_drafts          unread counters
   trust, analytics                        pub/sub for chat
   audit_logs                              short-TTL caches
```

Each database is owned for what it's good at: PostgreSQL is the ACID source of
truth, MongoDB holds high-volume chat data, Redis holds realtime state and
message delivery — never messages or money.

## Demo accounts (temporary login)

All seeded by `backend/seed_demo_users.py` — password for all: **`demo1234`**.
The login screen also has **one-click demo buttons** for each account.

| Key | Email | Role | Profile |
|-----|-------|------|---------|
| seller1 | seller1@technova.local | Seller | Rajesh Handicrafts (verified, 3 products) |
| seller2 | seller2@technova.local | Seller | Meena Organics (verified, 3 products) |
| buyer1 | buyer1@technova.local | Buyer | Arjun Mehta |
| buyer2 | buyer2@technova.local | Buyer | Sana Khan |
| admin | admin@technova.local | Admin | Verification review / audit logs |

Demo conversations (with unread badges) exist between seller1 ↔ buyer1 and
seller2 ↔ buyer2 — open two browsers (or an incognito window), log in on each
side, and chat in realtime over the WebSocket.

## Quick start

Prerequisites: Node.js 18+, Python 3.12, and the cloud credentials already in
`backend/.env` (Neon PostgreSQL, MongoDB Atlas, Redis Cloud).

### 1. Backend

```bash
cd backend
py -3.12 -m venv .venv                 # create the virtualenv
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe -m alembic upgrade head        # schema (PostgreSQL)
.venv/Scripts/python.exe seed_demo_users.py             # 2 sellers + 2 buyers + admin
.venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- API docs (Swagger): http://localhost:8000/api/docs
- Health check: http://localhost:8000/api/v1/health

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — use the **Temporary demo login** buttons on the
login screen (or the credentials above).

## API integration (unified inbox email sync)

Sellers can connect Gmail / Microsoft Outlook and pull email into the same
MongoDB conversations as in-app chat — every message tagged by `source`.

- `POST /api/v1/integrations/{service}/connect` → OAuth authorization URL (state bound to the user in Redis)
- `GET /api/v1/integrations/{service}/callback?code=&state=` → state-validated token exchange → `api_tokens` row
- `GET /api/v1/integrations` · `DELETE /api/v1/integrations/{service}` · `POST /api/v1/integrations/{service}/sync`

**Mock mode** (no credentials needed): until `GMAIL_CLIENT_ID` / `MICROSOFT_CLIENT_ID`
are set in `.env`, connect returns a URL that loops back to the callback and
sync drops sample email into the seller's inbox. Real OAuth activates
automatically once credentials are configured.

## Realtime chat

- REST: `POST /api/v1/conversations`, `GET /api/v1/conversations/{id}/messages?cursor=&limit=`
- WebSocket: `ws://localhost:8000/ws/chat?token=<jwt>`
- Flow: authenticate → validate conversation membership → persist to MongoDB →
  publish via Redis pub/sub → deliver to the recipient → update Redis unread → ack sender.
- Reconnection: client sends `last_received_sequence`; the server returns only the gap.
- AI sentiment is attached to every message; sellers can draft replies with AI and
  review before sending (never auto-sent).

## Verification

```bash
cd backend
# with the server running on 127.0.0.1:8010
.venv/Scripts/python.exe smoke_test.py   # 32 checks: auth, chat, orders, payments, analytics, RBAC
.venv/Scripts/python.exe smoke_ws.py     # realtime: WS delivery, typing, reconnection sync
.venv/Scripts/python.exe test_db_connections.py  # all 3 databases
```

## Project structure

```
backend/app/
├── core/            # config, security, exceptions, dependencies
├── infrastructure/  # postgres / mongodb / redis clients
└── modules/         # authentication, seller_profile, buyer_profile, product_listing,
                     # buyer_discovery, unified_inbox, ai_communication, human_approval,
                     # orders, payments, analytics, admin
frontend/src/
├── components/      # shared UI (LoginScreen with demo login, headers, nav)
├── hooks/           # useChatSocket (authenticated WS chat)
├── modules/         # buyer app, seller dashboard, unified-inbox, product-listing...
└── services/        # API client (storage.js) — all data from the backend
```

## License

Proprietary — TECHNOVA Team