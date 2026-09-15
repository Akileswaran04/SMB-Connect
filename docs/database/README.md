# TECHNOVA Database Architecture

## Current Phase: PostgreSQL Only

For the Seller Profile module, only PostgreSQL is active.

## Database Design Principles

1. **Separate identity from business data** — `users` for auth, `seller_profiles` for business
2. **Verification as separate entity** — `seller_verifications` for document tracking
3. **State machine for status** — Enum-based, not arbitrary strings
4. **Timestamps everywhere** — `created_at`, `updated_at` on all tables
5. **UUID primary keys** — For distributed-friendly IDs

## Current Tables (PostgreSQL)

### `users`
```
id              UUID PK
email           VARCHAR(254) UNIQUE NOT NULL
password_hash   VARCHAR(255) NOT NULL
role            ENUM(seller, buyer, admin) NOT NULL
is_active       BOOLEAN NOT NULL DEFAULT true
created_at      TIMESTAMP NOT NULL
updated_at      TIMESTAMP NOT NULL
```

### `seller_profiles`
```
id                  UUID PK
user_id             UUID FK → users.id UNIQUE NOT NULL
business_name       VARCHAR(200) NOT NULL
business_type       VARCHAR(50) NOT NULL
description         TEXT
phone               VARCHAR(20)
email               VARCHAR(254)
website             VARCHAR(2000)
address_line_1      VARCHAR(500)
address_line_2      VARCHAR(500)
city                VARCHAR(100)
state               VARCHAR(100)
country             VARCHAR(100) DEFAULT 'India'
postal_code         VARCHAR(20)
license_number      VARCHAR(100)
verification_status ENUM(DRAFT, SUBMITTED, UNDER_REVIEW, VERIFIED, REJECTED, SUSPENDED)
created_at          TIMESTAMP NOT NULL
updated_at          TIMESTAMP NOT NULL
```

### `seller_verifications`
```
id                  UUID PK
seller_id           UUID FK → seller_profiles.id NOT NULL
verification_type   VARCHAR(50) NOT NULL
document_reference  VARCHAR(500)
status              VARCHAR(50) NOT NULL DEFAULT 'pending'
reviewed_by         VARCHAR(254)
reviewed_at         TIMESTAMP
rejection_reason    TEXT
created_at          TIMESTAMP NOT NULL
updated_at          TIMESTAMP NOT NULL
```

## Future Tables

### PostgreSQL (Commerce & Trust)
- `products` — Product catalog
- `orders` — Order management
- `transactions` — Payment records
- `reviews` — Customer reviews
- `trust_scores` — Seller trust metrics
- `analytics` — Performance data
- `audit_logs` — System audit trail

### MongoDB (Communication)
- `conversations` — Message threads
- `messages` — Individual messages
- `ai_logs` — AI communication history

### Redis (Realtime)
- WebSocket sessions
- Online status
- Typing indicators
- Cache layer
- Pub/Sub channels
