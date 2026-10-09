# SMBConnect

**Less effort. More satisfaction.** An AI-assisted commerce platform for MSMEs:
the buyer says what they need, the platform narrows it to the few options that
matter, explains why, helps them bargain and buy, and handles delivery and
tracking — so the next purchase is even easier.

Four apps, one backend: **Buyer**, **Seller**, **Delivery partner**, **Admin**.

## What's in it

| Area | Highlights |
|---|---|
| Guided buying | "What are you looking for today?" by text or voice (English, Tamil, Tanglish, Hindi…); "I understood" chips; one follow-up question at most; 2–3 picks tagged Best Fit / Better Value / Faster Delivery / Premium Option, each with "Why this?" |
| Catalogue & search | Categories, keyword and natural-language search, filters (price range, size, colour, seller, stock, delivery time) and sorting; product page with variants, delivery date, returns, reviews and seller trust |
| Assistant | Action-oriented: search, cheaper, similar, stock/size check, delivery date, compare, bargain, message seller, track, reorder, product questions. Replies spoken back in the buyer's language. It never commits the buyer — offers and messages need a tap |
| Negotiation | Seller floor, auto-accept, counter-offer range (auto-counter), max rounds, quantity discounts; "₹1000 is outside the range — try ₹1150?"; negotiated price flows into the cart |
| Chat | Realtime buyer ↔ seller chat, auto-translated into each side's language, voice messages with read-aloud; AI reply drafts for sellers (always approved by a human) |
| Checkout & orders | Variants, discounts, delivery charges, standard/express, UPI / card / net banking / COD; order confirmation; My Orders tabs; cancel, return, review, dispute, invoice, Buy Again |
| Inventory | Available / reserved / on hand / incoming per product or variant; reservation on order, release on cancel, restock on return; full change log; no overselling (row locks) |
| Logistics | Seller creates the shipment (package details, partner, label); partner accepts, picks up, hub, transit, out for delivery, delivers with proof of delivery (buyer OTP, name, photo, time) or records a failed attempt |
| Notifications | In-app (live over WebSocket) for every order, payment, negotiation, shipment and dispute event, delay alerts and reorder reminders |
| Personalisation | Remembers sizes, colours, budgets, sellers and delivery preference from orders; buyer-controlled, can be switched off |
| Seller hub | Dashboard, products (SKU, sale/promo/bulk pricing, variants, delivery & returns, specs), inventory, orders, negotiation, customers, shipments, payments & settlements, analytics |
| Admin | Dashboard & alerts, users (verify/suspend/roles), seller verification (approve/reject/request info), product moderation & categories, order inspection (payment, shipment, chat, disputes), disputes & refunds, analytics, platform settings, settlements, audit log |

## Architecture

```
React (Vite) — buyer / seller / logistics / admin apps
        │  REST + WebSocket
FastAPI modular monolith  ─ AI orchestration (Groq) — the model only classifies
        │                    and extracts; backend services do every action
PostgreSQL (Neon)   MongoDB (Atlas)        Redis
orders, stock,      chat messages,         realtime pub/sub, presence,
payments, shipments conversations          rate limits, OTP, caches
```

## Demo accounts

`python seed_demo_users.py` creates them (password **`demo1234`**); the login
screen has one-click buttons.

| Role | Email | Notes |
|---|---|---|
| Buyer | buyer1@technova.local … buyer3 | Chennai / Coimbatore / Madurai |
| Seller | seller1@technova.local … seller4 | seller4 = Chennai Footwear Co (sized shoes, negotiation rules) |
| Delivery | logistics1@technova.local, logistics2 | SwiftShip Chennai, Kaveri Express |
| Admin | admin@technova.local | |

## Run it

```bash
# backend
cd backend
py -3.12 -m venv .venv && .venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe seed_demo_users.py
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000 --reload   # docs: /api/docs

# frontend
cd frontend && npm install && npm run dev                              # http://localhost:5173
```

Set `GROQ_API_KEY` in `backend/.env` for the AI features; without it they fall
back to keyword rules. See `backend/.env.example` for every setting.

### Simulated in development

These flows are complete, but talk to stand-ins until real providers are configured:

- **Payments** — recorded as completed (COD stays pending until delivery); no money moves.
- **SMS / email / WhatsApp / push** — notifications are stored in-app and logged per channel.
- **OTP** — with `OTP_DEV_MODE=true` the code is returned to the login screen.
- **Payouts** — admin "Run settlements" marks payouts settled.
- **Speech** — speech-to-text and text-to-speech use the browser (Chrome/Edge).

## Tests

With the backend running on port 8010:

```bash
cd backend
.venv/Scripts/python.exe e2e_prd_test.py   # the PRD §71 final product test (35 scenarios) + admin/returns/disputes
.venv/Scripts/python.exe smoke_test.py      # core API regression
.venv/Scripts/python.exe smoke_ws.py        # realtime chat
```
