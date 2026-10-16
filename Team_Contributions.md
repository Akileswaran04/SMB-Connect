# SMBConnect — Module-wise Team Contributions

**Project Title:** SMBConnect — AI-Assisted Commerce Platform for MSMEs
**Team Number:** `<TEAM NO>`

| Name | Roll Number | Modules Owned | Lines of Code |
|---|---|---|---|
| Akileswaran | `<ROLL NO>` | Unified Inbox, Voice Assistant, API Integration, Admin, Notifications, Platform, Frontend & Integration | 9,734 |
| Gobiha | `<ROLL NO>` | Authentication, Seller Profile, Buyer Profile, Human Approval, Orders, Analytics, Shipments, Logistics, Disputes | 6,494 |
| Monicka Sree | `<ROLL NO>` | Customer Management, Buyer Discovery, Recommendation, AI Communication, Payments, Product Listing, Catalogue, Inventory, Cart, Negotiation | 5,256 |
| **Total** | | **26 modules** | **21,484** |

> Lines of code = non-blank lines in the module's backend folder (`backend/app/modules/<module>`) plus its frontend screens. Shared frontend and backend code is counted under "Frontend & System Integration".

---

## Akileswaran

### 1. Unified Inbox

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Akileswaran |
| Roll Number | `<ROLL NO>` |
| Contribution | Built one inbox where a seller sees every buyer conversation. Messages arrive live over WebSockets; the connection is checked with JWT, and Redis pub/sub passes new messages between server workers so nothing is missed. |
| What I Learnt | How to run real-time chat at scale: managing WebSocket connections, reconnecting when they drop, and passing events between server workers with Redis pub/sub. I also learnt how to store chat history in MongoDB with the right indexes so loading a conversation stays fast. |
| Deliverable | Real-time inbox API and WebSocket endpoint; conversation list, chat view and chat-bubble screens. |
| Lines of Code | 1,380 (Backend 824 · Frontend 556) |
| Tools / Tech / Language / Framework | Python, FastAPI, WebSockets, JWT, Redis Pub/Sub, MongoDB (Motor), React, JavaScript |

### 2. Voice Assistant

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Akileswaran |
| Roll Number | `<ROLL NO>` |
| Contribution | Built a voice and chat assistant, so a buyer can say something like "black formal shoes under ₹1500" and get matching products. The browser turns speech into text, the backend works out what the buyer wants (product, budget, size), and the reply can be read back aloud in the user's language. |
| What I Learnt | Using the browser's speech APIs (speech-to-text and text-to-speech) across different languages, and how to get an LLM to return structured data reliably. I also learnt to always build a fallback for when the AI service is down. |
| Deliverable | Assistant API with the request-understanding service; voice input button, assistant page and quick-action screens. |
| Lines of Code | 1,001 (Backend 704 · Frontend 297) |
| Tools / Tech / Language / Framework | Python, FastAPI, Groq LLM API, Web Speech API, React, JavaScript, Redis |

### 3. API Integration

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Akileswaran |
| Roll Number | `<ROLL NO>` |
| Contribution | Let a seller connect an outside email inbox (Gmail or Microsoft Outlook) through OAuth, so their customer emails can flow into the platform. Access tokens are stored securely, and a mock mode lets the flow be demoed without real keys. |
| What I Learnt | How OAuth 2.0 works step by step (redirect, `state` check, exchanging the code for a token), how to store access tokens safely, and how to design a feature that works in demo mode until real credentials are added. |
| Deliverable | OAuth connect and disconnect APIs and the database model for connected accounts. |
| Lines of Code | 345 (Backend 345) |
| Tools / Tech / Language / Framework | Python, FastAPI, OAuth 2.0, httpx, SQLAlchemy, PostgreSQL, Redis |

### 4. Admin

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Akileswaran |
| Roll Number | `<ROLL NO>` |
| Contribution | Built the admin console: managing users and sellers, platform-wide statistics such as buyer satisfaction and average delivery time, and seller payouts that pay out completed orders and notify each seller. |
| What I Learnt | Designing role-based access so only admins reach these screens, and writing database queries that summarise data across the whole platform. I also learnt how to update many payment records safely in one batch. |
| Deliverable | Admin APIs and the admin app (all admin pages). |
| Lines of Code | 1,162 (Backend 642 · Frontend 520) |
| Tools / Tech / Language / Framework | Python, FastAPI, SQLAlchemy (async), PostgreSQL, React, Tailwind CSS |

### 5. Notifications

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Akileswaran |
| Roll Number | `<ROLL NO>` |
| Contribution | Built the notification system. Every event is saved as an in-app notification and sent live over WebSocket. Each user can choose which channels they want (email, SMS, WhatsApp, push), and background jobs send reminders. |
| What I Learnt | Running background jobs in an async server, letting each user set their notification preferences, and keeping the code that sends messages separate, so a real SMS or WhatsApp provider can be added later by changing one function. |
| Deliverable | Notifications API, background job runner and notification bell screen. |
| Lines of Code | 281 (Backend 193 · Frontend 88) |
| Tools / Tech / Language / Framework | Python, FastAPI, asyncio, WebSockets, Redis, React |

### 6. Platform

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Akileswaran |
| Roll Number | `<ROLL NO>` |
| Contribution | Platform-wide settings and services that the admin and order modules use, such as platform fees and configuration values. |
| What I Learnt | Keeping settings in one place so business rules don't get copied into many modules. |
| Deliverable | Platform settings models and service. |
| Lines of Code | 59 (Backend 59) |
| Tools / Tech / Language / Framework | Python, SQLAlchemy, PostgreSQL |

### 7. Frontend & System Integration

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Akileswaran |
| Roll Number | `<ROLL NO>` |
| Contribution | Built the frontend structure (seller and buyer apps, layout, sidebar, bottom navigation, shared UI kit, toasts) and the shared API and state layer. On the backend: app startup, the shared core (settings, security, AI client, logging), PostgreSQL, MongoDB and Redis connections, Alembic database migrations, combining all modules' database models, demo data seeding, and the end-to-end and smoke test scripts. |
| What I Learnt | How to fit about 25 modules into one product: a clear folder layout, one API client, consistent error handling, and managing database schema changes with migrations. Writing end-to-end tests showed me bugs where modules connect that no single module's code would reveal. |
| Deliverable | Working React app shell; FastAPI app with all routers connected; 10 database migrations; demo data script; end-to-end test (35 scenarios) and smoke tests. |
| Lines of Code | 5,506 (Backend 3,565 · Frontend 1,941) |
| Tools / Tech / Language / Framework | React 19, Vite, Tailwind CSS, JavaScript, Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL, MongoDB, Redis, Docker Compose, Git |

---

## Gobiha

### 8. Authentication

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Gobiha |
| Roll Number | `<ROLL NO>` |
| Contribution | Built sign-up and login with a password or a one-time code (OTP). Passwords are hashed with bcrypt and sessions use JWT tokens. There are four roles (buyer, seller, delivery partner, admin), and Redis limits how often a login or OTP can be tried. OTP codes are stored hashed and expire quickly. |
| What I Learnt | Why passwords and OTPs must be stored hashed, how JWT tokens carry a user's role, and how to block brute-force login attempts with rate limiting. I also learnt to keep login working when Redis is down by falling back to memory. |
| Deliverable | Register, login, OTP and demo-login APIs; login and onboarding screens. |
| Lines of Code | 806 (Backend 434 · Frontend 372) |
| Tools / Tech / Language / Framework | Python, FastAPI, JWT, bcrypt, Redis, Pydantic, React |

### 9. Seller Profile

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Gobiha |
| Roll Number | `<ROLL NO>` |
| Contribution | Built seller onboarding and profile management: business details, business type checks, a verification workflow (draft → submitted → verified) that only allows valid status changes, UPI and bank payout details (only the last 4 digits of the bank account are ever shown), uploading verification documents, and the seller's main dashboard data. |
| What I Learnt | Building a workflow that blocks invalid status changes, checking a profile is complete before it can be submitted for verification, handling sensitive data like bank account numbers safely, and building multi-step onboarding forms. |
| Deliverable | Seller profile APIs, input checks and the seller dashboard API; profile form, document upload and profile tab screens. |
| Lines of Code | 1,502 (Backend 806 · Frontend 696) |
| Tools / Tech / Language / Framework | Python, FastAPI, Pydantic, SQLAlchemy, PostgreSQL (JSONB), React, Tailwind CSS |

### 10. Buyer Profile

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Gobiha |
| Roll Number | `<ROLL NO>` |
| Contribution | Built buyer profiles: details, saved addresses, preferred language, contact channels, and personalisation that learns from a buyer's activity to shape what they see. |
| What I Learnt | Structuring user preference data so other modules (recommendations, the assistant) can use it, and building personalisation from simple activity signals. |
| Deliverable | Buyer profile and buyer dashboard APIs, personalisation service and profile page. |
| Lines of Code | 777 (Backend 542 · Frontend 235) |
| Tools / Tech / Language / Framework | Python, FastAPI, SQLAlchemy, PostgreSQL, React |

### 11. Human Approval

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Gobiha |
| Roll Number | `<ROLL NO>` |
| Contribution | Built the human approval step. Every reply the AI drafts waits for the seller to approve, edit or reject it before it reaches a buyer, and every decision is recorded. |
| What I Learnt | Designing an approval workflow with clear states (pending, approved, edited, rejected) and why a person should check AI output before it reaches a customer. |
| Deliverable | Approval queue API and the AI draft review screen. |
| Lines of Code | 381 (Backend 269 · Frontend 112) |
| Tools / Tech / Language / Framework | Python, FastAPI, SQLAlchemy, PostgreSQL, React |

### 12. Orders

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Gobiha |
| Roll Number | `<ROLL NO>` |
| Contribution | Built the full order lifecycle: placing an order, moving it through its stages (placed → confirmed → packed → shipped → delivered), cancellations and returns, delivery confirmed by OTP, and creating a payment record for each order (UPI, card, netbanking or cash on delivery). This is the largest backend module. |
| What I Learnt | Modelling a business process so an order can't jump to an invalid stage, keeping stock, payment and order changes in a single database transaction, and handling the extra rules for cash-on-delivery orders. |
| Deliverable | Orders API; seller orders tab and buyer orders, order detail and order confirmation screens. |
| Lines of Code | 1,452 (Backend 942 · Frontend 510) |
| Tools / Tech / Language / Framework | Python, FastAPI, SQLAlchemy (async), PostgreSQL, Pydantic, React |

### 13. Analytics

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Gobiha |
| Roll Number | `<ROLL NO>` |
| Contribution | Built the seller analytics and dashboard: sales trends, top products and order statistics. A background worker calculates the figures ahead of time so the dashboard loads quickly. |
| What I Learnt | Writing database summary queries, calculating figures in the background instead of on every page load, and picking the right chart for each kind of data. |
| Deliverable | Analytics API and background worker; analytics and dashboard tabs with charts. |
| Lines of Code | 529 (Backend 324 · Frontend 205) |
| Tools / Tech / Language / Framework | Python, FastAPI, SQLAlchemy, PostgreSQL, React, Recharts |

### 14. Shipments

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Gobiha |
| Roll Number | `<ROLL NO>` |
| Contribution | Built shipment creation, assignment to a delivery partner, status tracking, and handover at the door confirmed with an OTP. |
| What I Learnt | Using one-time codes to prove a delivery really happened, and tracking a shipment as it moves between seller, delivery partner and buyer. |
| Deliverable | Shipments API with OTP check; seller shipments tab. |
| Lines of Code | 609 (Backend 527 · Frontend 82) |
| Tools / Tech / Language / Framework | Python, FastAPI, SQLAlchemy, PostgreSQL, React |

### 15. Logistics

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Gobiha |
| Roll Number | `<ROLL NO>` |
| Contribution | Built the delivery partner app: see assigned pickups and drops, update delivery status, and record proof of delivery (the receiver's name as a signature). |
| What I Learnt | Designing a simple, mobile-first app for people who use it on the move, with few taps and large buttons. |
| Deliverable | Logistics API and delivery partner app. |
| Lines of Code | 331 (Backend 74 · Frontend 257) |
| Tools / Tech / Language / Framework | Python, FastAPI, SQLAlchemy, React, Tailwind CSS |

### 16. Disputes

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Gobiha |
| Roll Number | `<ROLL NO>` |
| Contribution | Built a way for buyers to raise a dispute on an order and for admins to look into it and resolve it. |
| What I Learnt | Keeping a clear record of every step of a dispute, and planning who is allowed to do what at each step. |
| Deliverable | Disputes API and database model. |
| Lines of Code | 107 (Backend 107) |
| Tools / Tech / Language / Framework | Python, FastAPI, SQLAlchemy, PostgreSQL |

---

## Monicka Sree

### 17. Customer Management

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Monicka Sree |
| Roll Number | `<ROLL NO>` |
| Contribution | Built each seller's customer list, with purchase history, order counts and repeat-buyer tracking. |
| What I Learnt | Pulling a customer view together from order data, and what information a small business needs to keep its regular buyers. |
| Deliverable | Customer management API and customers tab. |
| Lines of Code | 204 (Backend 162 · Frontend 42) |
| Tools / Tech / Language / Framework | Python, FastAPI, SQLAlchemy, PostgreSQL, React |

### 18. Buyer Discovery

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Monicka Sree |
| Roll Number | `<ROLL NO>` |
| Contribution | Built product search for buyers: search and filters, a home page, catalogue browsing, a product details page and side-by-side product comparison. Popular searches are cached in Redis so results come back quickly. |
| What I Learnt | Building search with filters and ranking, caching results with Redis, and designing pages that help buyers decide instead of overwhelming them. |
| Deliverable | Discovery and search API; home, catalogue, product and compare screens. |
| Lines of Code | 1,074 (Backend 316 · Frontend 758) |
| Tools / Tech / Language / Framework | Python, FastAPI, Redis, SQLAlchemy, PostgreSQL, React, Tailwind CSS |

### 19. Recommendation

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Monicka Sree |
| Roll Number | `<ROLL NO>` |
| Contribution | Built the recommendation engine. It narrows the choice down to a few good products and explains why each one fits the buyer. |
| What I Learnt | Scoring products on several signals (price, rating, nearness, preferences) and how explaining a recommendation makes buyers trust it more. |
| Deliverable | Recommendation API and recommendation card screen. |
| Lines of Code | 384 (Backend 317 · Frontend 67) |
| Tools / Tech / Language / Framework | Python, FastAPI, Redis, Groq LLM API, React |

### 20. AI Communication

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Monicka Sree |
| Roll Number | `<ROLL NO>` |
| Contribution | Built AI-drafted replies to buyer messages, aware of the conversation so far, plus sentiment detection to flag unhappy customers. The seller can turn auto-reply on or off; every draft goes to Human Approval before sending. |
| What I Learnt | Writing prompts for business replies, giving the AI the conversation so far, detecting sentiment, and handling AI timeouts with a fallback. |
| Deliverable | AI communication API, sentiment detection and the auto-reply switch. |
| Lines of Code | 378 (Backend 304 · Frontend 74) |
| Tools / Tech / Language / Framework | Python, FastAPI, Groq LLM API, Redis, React |

### 21. Payments

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Monicka Sree |
| Roll Number | `<ROLL NO>` |
| Contribution | Built payment records and status tracking for UPI, card, netbanking and cash on delivery, plus each seller's payments tab with when each payment will be paid out. |
| What I Learnt | How payment status changes over time, how marketplace payouts work, and why payment code should be separate from order code so a real gateway (such as Razorpay) can be added later. |
| Deliverable | Payments API and seller payments tab. |
| Lines of Code | 285 (Backend 239 · Frontend 46) |
| Tools / Tech / Language / Framework | Python, FastAPI, SQLAlchemy, PostgreSQL, React |

### 22. Product Listing

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Monicka Sree |
| Roll Number | `<ROLL NO>` |
| Contribution | Built product management for sellers: create and edit products, upload images, categories, product codes (SKU), sale and promo prices, and draft or published status. |
| What I Learnt | Designing product data that handles variants and pricing rules, and building a product editor that sellers find easy to use. |
| Deliverable | Product listing API; products tab and product editor. |
| Lines of Code | 887 (Backend 618 · Frontend 269) |
| Tools / Tech / Language / Framework | Python, FastAPI, SQLAlchemy, PostgreSQL, React, Tailwind CSS |

### 23. Catalogue

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Monicka Sree |
| Roll Number | `<ROLL NO>` |
| Contribution | Built the shared catalogue data and pricing logic (sale and promo prices, the final price a buyer pays) used by search, cart and orders. |
| What I Learnt | Keeping pricing rules in one place so the cart, the order and the invoice always show the same price. |
| Deliverable | Catalogue models and pricing rules. |
| Lines of Code | 85 (Backend 85) |
| Tools / Tech / Language / Framework | Python, SQLAlchemy, PostgreSQL |

### 24. Inventory

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Monicka Sree |
| Roll Number | `<ROLL NO>` |
| Contribution | Built stock tracking: available, reserved and incoming stock, low-stock alerts, and keeping stock in step with orders. |
| What I Learnt | Reserving stock during checkout so the same item can't be sold twice, and setting low-stock thresholds so sellers get warned in time. |
| Deliverable | Inventory API and inventory tab. |
| Lines of Code | 392 (Backend 285 · Frontend 107) |
| Tools / Tech / Language / Framework | Python, FastAPI, SQLAlchemy, PostgreSQL, React |

### 25. Cart

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Monicka Sree |
| Roll Number | `<ROLL NO>` |
| Contribution | Built the cart and checkout: add and remove items, choose a payment method, check out, and turn the cart into an order. |
| What I Learnt | Building a checkout that rechecks price and stock at payment time, and handling a cart that contains items from more than one seller. |
| Deliverable | Cart API and cart and checkout screen. |
| Lines of Code | 673 (Backend 444 · Frontend 229) |
| Tools / Tech / Language / Framework | Python, FastAPI, SQLAlchemy, PostgreSQL, React |

### 26. Negotiation

| Field | Details |
|---|---|
| Project Title | SMBConnect |
| Team Number | `<TEAM NO>` |
| Name | Monicka Sree |
| Roll Number | `<ROLL NO>` |
| Contribution | Built price bargaining between buyer and seller: buyers make offers and sellers counter, within the seller's own rules (lowest acceptable price, automatic acceptance). An accepted offer can go straight to an order. |
| What I Learnt | Turning a business rule like "never go below my lowest price" into code, and designing an offer and counter-offer flow that can't be misused. |
| Deliverable | Negotiation API; seller negotiation tab and buyer negotiation panel. |
| Lines of Code | 894 (Backend 609 · Frontend 285) |
| Tools / Tech / Language / Framework | Python, FastAPI, SQLAlchemy, PostgreSQL, React |

---

## Overall Tech Stack

| Layer | Tools / Tech |
|---|---|
| Languages | Python 3.12, JavaScript (ES2022) |
| Backend Framework | FastAPI, Pydantic, Uvicorn |
| Frontend Framework | React 19, Vite, Tailwind CSS, Recharts |
| Databases | PostgreSQL (SQLAlchemy async + Alembic), MongoDB (Motor), Redis |
| AI | Groq LLM API, Web Speech API |
| Realtime | WebSockets, Redis Pub/Sub |
| Security | JWT, bcrypt, OTP, rate limiting |
| Tooling | Git, Docker Compose, Pytest, Ruff, Black, oxlint |
