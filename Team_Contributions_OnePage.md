# SMBConnect — AI-Assisted Commerce Platform for MSMEs

**Team No: ________** · Total lines of code: **21,484**

| Name | Module | Total Lines of Code | Tools / Tech / Language / Framework | What I Learnt | Deliverable |
|---|---|---|---|---|---|
| **Akileswaran**<br>Roll No: ____<br>(9,734 lines) | Unified Inbox | 1,380 | Python, FastAPI, WebSockets, JWT, Redis Pub/Sub, MongoDB, React | Real-time chat with WebSockets, reconnects, Redis pub/sub across workers, MongoDB indexing | Live inbox API + WebSocket, conversation list & chat screens |
|  | Voice Assistant | 1,001 | Python, FastAPI, Groq LLM, Web Speech API, React | Browser speech-to-text/text-to-speech, getting structured data from an LLM, AI fallbacks | Assistant API with request understanding, voice input & assistant page |
|  | API Integration | 345 | Python, FastAPI, OAuth 2.0, httpx, PostgreSQL | OAuth 2.0 flow, storing tokens securely, mock mode for demos | Gmail / Outlook connect & disconnect APIs |
|  | Admin | 1,162 | Python, FastAPI, SQLAlchemy, PostgreSQL, React, Tailwind | Role-based access, platform-wide summary queries, batch payouts | Admin APIs + admin console (users, stats, payouts) |
|  | Notifications | 281 | Python, FastAPI, asyncio, WebSockets, Redis, React | Background jobs, per-user channel settings, swappable sending providers | Notifications API, background jobs, notification bell |
|  | Platform | 59 | Python, FastAPI, SQLAlchemy, PostgreSQL | Keeping platform settings and fees in one place | Platform settings models & service |
|  | Frontend & Integration | 5,506 | React 19, Vite, Tailwind, FastAPI, Alembic, PostgreSQL, MongoDB, Redis, Docker | Joining 25 modules into one app, database migrations, end-to-end testing | App shell, API layer, 10 migrations, demo data, end-to-end & smoke tests |
| **Gobiha**<br>Roll No: ____<br>(6,494 lines) | Authentication | 806 | Python, FastAPI, JWT, bcrypt, Redis, React | Hashing passwords & OTPs, roles in JWT tokens, login rate limits | Register / login / OTP APIs, login & onboarding screens |
|  | Seller Profile | 1,502 | Python, FastAPI, SQLAlchemy, PostgreSQL (JSONB), React | Verification workflow with valid status changes, protecting bank details | Seller profile & dashboard APIs, profile form, document upload |
|  | Buyer Profile | 777 | Python, FastAPI, SQLAlchemy, PostgreSQL, React | Storing buyer preferences, personalising from buyer activity | Buyer profile & personalisation APIs, profile page |
|  | Human Approval | 381 | Python, FastAPI, SQLAlchemy, PostgreSQL, React | Approval workflow (approve / edit / reject), human review of AI output | Approval queue API, AI draft review screen |
|  | Orders | 1,452 | Python, FastAPI, SQLAlchemy, PostgreSQL, Pydantic, React | Order stages that can't be skipped, transactions across stock and payment, COD rules | Orders API, seller & buyer order screens |
|  | Analytics | 529 | Python, FastAPI, SQLAlchemy, PostgreSQL, React, Recharts | Summary queries, calculating figures in the background, choosing charts | Analytics API + worker, dashboard & charts |
|  | Shipments | 609 | Python, FastAPI, SQLAlchemy, PostgreSQL, React | OTP proof of delivery, tracking shipment status | Shipments API with OTP handover, shipments tab |
|  | Logistics | 331 | Python, FastAPI, SQLAlchemy, React, Tailwind | Mobile-first design for delivery partners | Logistics API, delivery partner app |
|  | Disputes | 107 | Python, FastAPI, SQLAlchemy, PostgreSQL | Recording every step of a dispute, who can do what | Disputes API & model |
| **Monicka Sree**<br>Roll No: ____<br>(5,256 lines) | Customer Management | 204 | Python, FastAPI, SQLAlchemy, PostgreSQL, React | Building a customer view from order history | Customer API, customers tab |
|  | Buyer Discovery | 1,074 | Python, FastAPI, SQLAlchemy, PostgreSQL, Redis, React, Tailwind | Search with filters & ranking, Redis caching | Search API, home / catalogue / product / compare screens |
|  | Recommendation | 384 | Python, FastAPI, Redis, Groq LLM, React | Scoring products on several signals, explaining each pick | Recommendation API, recommendation cards |
|  | AI Communication | 378 | Python, FastAPI, Groq LLM, Redis, React | Writing prompts, giving the AI chat history, sentiment detection, AI fallbacks | AI reply API, sentiment detection, auto-reply switch |
|  | Payments | 285 | Python, FastAPI, SQLAlchemy, PostgreSQL, React | Payment status over time, payouts, gateway-ready design | Payments API, seller payments tab |
|  | Product Listing | 887 | Python, FastAPI, SQLAlchemy, PostgreSQL, React, Tailwind | Product data with sizes and pricing rules, editor design | Product API, products tab & editor |
|  | Catalogue | 85 | Python, SQLAlchemy, PostgreSQL | Keeping pricing rules in one place | Catalogue models & pricing rules |
|  | Inventory | 392 | Python, FastAPI, SQLAlchemy, PostgreSQL, React | Reserving stock so items aren't oversold, low-stock alerts | Inventory API, inventory tab |
|  | Cart | 673 | Python, FastAPI, SQLAlchemy, PostgreSQL, React | Rechecking price & stock at checkout, carts with several sellers | Cart & checkout API, checkout screen |
|  | Negotiation | 894 | Python, FastAPI, SQLAlchemy, PostgreSQL, React | Turning seller price rules into code, offer/counter-offer flow | Negotiation API, seller tab & buyer panel |
