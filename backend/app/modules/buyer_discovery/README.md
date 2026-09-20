# Buyer Discovery Module

**Status**: Core search implemented; personalization/ML features planned.

## Overview
Buyer-facing product and seller discovery: search/filter products, view public
seller profiles, and browse a seller's catalog. Unauthenticated (public)
endpoints — this is what buyers see before/without logging in.

Seller-side CRM (a seller's own list of buyer contacts) lives in the separate
[`customer_management`](../customer_management/README.md) module — the two
used to share this folder under confusingly similar names
(`buyer_discovery_router` was actually the customer-management router) and
were split apart for clarity.

## Implemented API Endpoints
```
GET  /api/v1/discover                  - Search/filter products (category, location, budget, q)
GET  /api/v1/sellers/{seller_id}       - Public seller profile with trust score
GET  /api/v1/sellers/{seller_id}/products - Public product list for a seller
```

## Database
**Primary**: PostgreSQL (via `product_listing` and `seller_profile` models)

## Planned / Future Enhancements
- Full-text search (Elasticsearch)
- Buyer preferences, saved searches, watchlists
- ML-based personalized recommendations
- Search analytics for sellers
- Trending / new-arrivals endpoints
