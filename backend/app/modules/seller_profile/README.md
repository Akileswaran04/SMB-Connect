# Seller Profile Module

**Status: IMPLEMENTED**

## Responsibilities
- Seller business profile CRUD
- Profile verification workflow
- Status state machine (DRAFT → SUBMITTED → UNDER_REVIEW → VERIFIED)
- Business type validation
- License/document verification

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/sellers/profile` | Get current seller profile |
| POST | `/api/v1/sellers/profile` | Create new seller profile |
| PUT | `/api/v1/sellers/profile` | Update seller profile |
| POST | `/api/v1/sellers/profile/submit` | Submit for verification |
| PATCH | `/api/v1/sellers/profile/status` | Update verification status (admin) |

## Data Flow

```
Request → Router → Service → Repository → PostgreSQL
```

## Status State Machine

```
DRAFT → SUBMITTED → UNDER_REVIEW → VERIFIED
                       ↓
                    REJECTED → SUBMITTED (resubmit)
                       ↓
                    SUSPENDED
```

## Database Tables

- `users` — Identity (email, password, role)
- `seller_profiles` — Business information
- `seller_verifications` — Verification documents and history

## Files

- `router.py` — HTTP endpoints
- `schemas.py` — Pydantic request/response models
- `models.py` — SQLAlchemy database models
- `repository.py` — Database access layer
- `service.py` — Business logic
- `validators.py` — Validation rules
- `dependencies.py` — FastAPI dependency injection
