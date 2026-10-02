# Customer Management Module

**Status**: Implemented.

## Overview
Seller-side CRM: lets a seller maintain their own list of buyer contacts
(name, email, phone) independent of the platform's buyer accounts.

Split out from `buyer_discovery` (which is the buyer-facing product/seller
search feature) — the two lived in one folder under confusingly similar names
(`buyer_discovery_router` was this module, not buyer discovery) and were
separated so each module maps to one router/one domain, matching the rest of
`app/modules/`.

## Implemented API Endpoints
```
GET    /api/v1/customers               - List seller's customers
POST   /api/v1/customers               - Create a customer
GET    /api/v1/customers/{id}          - Get a customer
PUT    /api/v1/customers/{id}          - Update a customer
DELETE /api/v1/customers/{id}          - Delete a customer
```

## Database
**Primary**: PostgreSQL — `customers` table, scoped to the authenticated seller.
