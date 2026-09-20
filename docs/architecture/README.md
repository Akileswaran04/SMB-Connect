# TECHNOVA Architecture

## Overview

TECHNOVA is an **AI-Powered Digital Business Ecosystem for MSMEs** built with a **modular monolith** architecture.

## Design Principles

1. **Domain-driven** — Code organized by business domains (modules), not technology
2. **Infrastructure-agnostic** — Business logic doesn't depend on specific databases
3. **API-first** — REST + WebSocket interfaces
4. **Scalable** — Can be split into microservices when needed

## High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│                    Frontend                      │
│              React + Vite + Tailwind             │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Seller   │ │ Product  │ │ Unified Inbox    │ │
│  │ Profile  │ │ Listing  │ │ (Future)         │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└──────────────────────┬──────────────────────────┘
                       │ REST + WebSocket
                       ▼
┌─────────────────────────────────────────────────┐
│                  FastAPI Backend                  │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │              Module Layer                    │ │
│  │                                              │ │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │ │
│  │  │ Seller   │ │ Product  │ │ Unified     │ │ │
│  │  │ Profile  │ │ Listing  │ │ Inbox       │ │ │
│  │  │ ✅ NOW   │ │ 🔜 FUTURE│ │ 🔜 FUTURE   │ │ │
│  │  └──────────┘ └──────────┘ └─────────────┘ │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │           Infrastructure Layer               │ │
│  │                                              │ │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │ │
│  │  │ Postgres │ │ MongoDB  │ │ Redis       │ │ │
│  │  │ ✅ NOW   │ │ 🔜 FUTURE│ │ 🔜 FUTURE   │ │ │
│  │  └──────────┘ └──────────┘ └─────────────┘ │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Data Flow

```
Request → Router → Service → Repository → Database
                ↑
           Validators
```

## Module Boundaries

| Module | Status | Database | Description |
|--------|--------|----------|-------------|
| seller_profile | ✅ Active | PostgreSQL | Business profiles, verification |
| product_listing | 🔜 Future | PostgreSQL | Products, inventory, pricing |
| buyer_discovery | 🔜 Future | PostgreSQL | Search, recommendations |
| unified_inbox | 🔜 Future | PostgreSQL + MongoDB | Email, messaging, threading |
| ai_communication | 🔜 Future | MongoDB | AI drafting, sentiment analysis |
| human_approval | 🔜 Future | PostgreSQL | Review queues, audit trails |
| analytics | 🔜 Future | PostgreSQL | Metrics, reports, forecasting |
| api_integration | 🔜 Future | PostgreSQL | External APIs, webhooks |
| admin | 🔜 Future | PostgreSQL | User management, system config |
| authentication | 🔜 Future | PostgreSQL | JWT, OAuth2, RBAC |
