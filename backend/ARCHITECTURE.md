# TECHNOVA Backend Architecture

**Version**: 1.0.0  
**Last Updated**: August 30, 2024  
**Status**: Foundation Complete - Seller Profile Implemented, Future Modules Planned

## Executive Summary

TECHNOVA is an AI-powered digital business ecosystem for MSMEs built on a **modular monolith architecture** that can evolve into microservices. The system uses a **polyglot persistence** approach with PostgreSQL for transactional data, MongoDB for communication history, and Redis for real-time features.

---

## System Architecture

### 3-Database Architecture

```
                    TECHNOVA BACKEND
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
    PostgreSQL          MongoDB             Redis
    ─────────           ───────             ─────
    Transactional       High-Volume         Real-Time
    Business Data       Communication       Features
        │                   │                │
        │                   │                │
        ▼                   ▼                ▼
    • Users           • Messages          • Online Status
    • Sellers         • Conversations     • Typing Indicators
    • Buyers          • AI Logs           • Cache
    • Products        • Notifications     • Pub/Sub
    • Orders          • Threads           • Sessions
    • Reviews         
    • Trust Scores    
    • Analytics       
    • Audit Logs      
```

### Database Responsibilities

#### PostgreSQL (Primary - Supabase)
**Connection**: `postgresql://postgres:***@<YOUR_SUPABASE_HOST>.supabase.co:5432/postgres`

Stores all structured business data with ACID guarantees:

- **User Management**: Users (identity, roles, OAuth)
- **Seller Module**: Seller profiles, verifications, trust scores
- **Buyer Module**: Buyer profiles, preferences
- **Products**: Product listings, inventory, images
- **Commerce**: Orders, order items, transactions
- **Trust & Quality**: Reviews, ratings, trust scores
- **Analytics**: Aggregated metrics, daily reports
- **Audit**: Complete audit trail of all operations

**Key Tables** (12 tables, 50+ indexes):
```
users → seller_profiles ↔ seller_verifications
     → buyer_profiles → orders → order_items
                    → transactions
                    → reviews
             → products → reviews
trust_scores
analytics
audit_logs
```

#### MongoDB (Secondary - Atlas)
**Connection**: `mongodb+srv://<YOUR_MONGODB_USER>:***@<YOUR_MONGODB_CLUSTER>.mongodb.net`

Stores high-volume, semi-structured communication data:

- **Conversations**: Metadata and participant lists
- **Messages**: Full message content, attachments, reactions
- **Message Threads**: Email threading logic
- **AI Interactions**: AI processing history, sentiment analysis
- **Conversation Analytics**: Aggregated conversation metrics
- **Notification Queue**: Pending notifications for delivery

**Key Collections** (6 collections with flexibility for growth):
```
conversations (1M+ documents)
├── messages (100M+ documents)
├── message_threads (10M+ documents)
├── ai_interactions (100M+ documents)
├── conversation_analytics (1M+ documents)
└── notification_queue (10M+ documents per day)
```

#### Redis (Tertiary - Optional, Local/Cloud)
**Connection**: `redis://localhost:6379/0`

Stores ephemeral, high-speed data:

- **Online Status**: `online_users:{seller_id}` = timestamp
- **Typing Indicators**: `typing:{conversation_id}` = list of user_ids
- **Cache**: Product details, seller profiles, search results
- **Pub/Sub**: Message delivery, notification channels
- **Sessions**: User sessions and tokens
- **Rate Limiting**: API rate limit counters
- **Counters**: Real-time metrics (views, clicks, sales)

---

## Module Architecture

### Implemented Modules

#### 1. Seller Profile Management (✅ IMPLEMENTED)

**Status**: Production-Ready  
**API Prefix**: `/api/v1/sellers`

**Responsibilities**:
- Seller registration and profile management
- Business information collection
- Document/license verification
- Profile status workflow (DRAFT → SUBMITTED → UNDER_REVIEW → VERIFIED/REJECTED)
- Seller dashboard and settings

**File Structure**:
```
seller_profile/
├── __init__.py
├── router.py           # HTTP endpoints
├── schemas.py          # Pydantic request/response models
├── models.py           # SQLAlchemy ORM models
├── repository.py       # Database access layer
├── service.py          # Business logic
├── dependencies.py     # Dependency injection
├── validators.py       # Custom validation rules
└── README.md           # Documentation
```

**Database Tables**:
- `seller_profiles` (1,000-10,000 records expected)
- `seller_verifications` (link to verification process)

**Key Endpoints**:
```
POST   /api/v1/sellers/profile               Create profile
GET    /api/v1/sellers/profile                Get my profile
PUT    /api/v1/sellers/profile                Update profile
PATCH  /api/v1/sellers/profile/status         Update status
POST   /api/v1/sellers/profile/submit         Submit for verification
```

---

### Future Modules (Planned)

#### 2. Authentication (M1 - Not Yet Started)
- **Status**: Planned
- **Purpose**: User registration, login, OAuth, JWT, RBAC
- **Primary DB**: PostgreSQL (`users` table)
- **Dependencies**: `python-jose`, `passlib`, FastAPI security

#### 3. Product Listing (M3 - Not Yet Started)
- **Status**: Planned
- **Purpose**: Product CRUD, inventory, images, categorization
- **Primary DB**: PostgreSQL (`products`, `product_images` tables)
- **Secondary**: S3/Object Storage for images
- **Dependencies**: SQLAlchemy, Boto3

#### 4. Buyer Discovery (M4 - Not Yet Started)
- **Status**: Planned
- **Purpose**: Product search, filtering, recommendations, watchlist
- **Primary DB**: PostgreSQL + Elasticsearch (future)
- **Secondary**: Redis (cache, search queries)
- **Dependencies**: Elasticsearch, Redis

#### 5. Unified Inbox (M5 - Not Yet Started)
- **Status**: Planned
- **Purpose**: Email sync (Gmail, Outlook), in-app messaging, real-time
- **Primary DB**: PostgreSQL (metadata)
- **Secondary**: MongoDB (messages, threads)
- **Tertiary**: Redis (real-time state)
- **External APIs**: Gmail API, Microsoft Graph
- **Dependencies**: Motor (MongoDB async), Aioredis, FastAPI WebSocket

#### 6. AI Communication Intelligence (M6 - Not Yet Started)
- **Status**: Planned
- **Purpose**: Smart replies, sentiment analysis, intent classification
- **Primary DB**: PostgreSQL + MongoDB
- **External APIs**: OpenAI, Hugging Face
- **Dependencies**: Langchain, Transformers

#### 7. Human Approval (M7 - Not Yet Started)
- **Status**: Planned
- **Purpose**: Approval workflows, dispute resolution, SLA tracking
- **Primary DB**: PostgreSQL (`approval_requests`, `approval_actions`)
- **Dependencies**: SQLAlchemy

#### 8. Analytics Dashboard (M8 - Not Yet Started)
- **Status**: Planned
- **Purpose**: Sales metrics, traffic, conversion, revenue tracking
- **Primary DB**: PostgreSQL (`analytics` table)
- **Secondary**: InfluxDB (future) for time-series data
- **Tertiary**: Redis (real-time counters)

#### 9. API Integration (M9 - Not Yet Started)
- **Status**: Planned
- **Purpose**: Payment gateways, shipping APIs, webhooks
- **Primary DB**: PostgreSQL (`api_connections`, `webhooks`, `webhook_logs`)
- **External APIs**: Stripe, PayPal, Shippo, SendGrid
- **Dependencies**: Httpx, Pydantic

#### 10. Admin Panel (M10 - Not Yet Started)
- **Status**: Planned
- **Purpose**: User management, seller verification, moderation, system config
- **Primary DB**: PostgreSQL (all tables)
- **Dependencies**: SQLAlchemy, FastAPI

---

## Layered Architecture

### Vertical Slices (Per Module)

Each module follows this pattern:

```
HTTP Request
    │
    ▼
┌─────────────────────────────┐
│   router.py                 │ ← HTTP endpoints, request handling
├─────────────────────────────┤
│   schemas.py                │ ← Pydantic validation models
├─────────────────────────────┤
│   service.py                │ ← Business logic, orchestration
├─────────────────────────────┤
│   repository.py             │ ← Database queries (DAO pattern)
├─────────────────────────────┤
│   models.py                 │ ← SQLAlchemy ORM definitions
└─────────────────────────────┘
    │
    ▼
  Database
```

### Horizontal Layers (Cross-Cutting)

```
┌─────────────────────────────────────────┐
│   FastAPI Application (main.py)         │ ← Startup, shutdown, middleware
├─────────────────────────────────────────┤
│   Core Layer                            │
│   ├── config.py (settings management)   │
│   ├── security.py (JWT, RBAC)           │
│   ├── exceptions.py (error handling)    │
│   ├── dependencies.py (DI container)    │
│   └── logging.py (structured logging)   │
├─────────────────────────────────────────┤
│   Infrastructure Layer                  │
│   ├── postgres/ (SQLAlchemy, session)   │
│   ├── mongodb/ (Motor async client)     │
│   ├── redis/ (Aioredis client)          │
│   └── storage/ (S3 object storage)      │
├─────────────────────────────────────────┤
│   Modules Layer                         │
│   ├── authentication/                   │
│   ├── seller_profile/                   │
│   ├── product_listing/                  │
│   └── ... (10 modules total)            │
├─────────────────────────────────────────┤
│   Shared Layer                          │
│   ├── constants/ (app-wide constants)   │
│   ├── enums/ (shared enumerations)      │
│   ├── schemas/ (shared Pydantic models) │
│   └── utils/ (utility functions)        │
└─────────────────────────────────────────┘
```

---

## Data Flow Examples

### Seller Profile Creation Flow

```
1. HTTP Request: POST /api/v1/sellers/profile
   └─> router.create_seller_profile(request)

2. Validation
   └─> SellerProfileCreate schema validates input

3. Business Logic
   └─> SellerProfileService.create_profile()
       ├─> Check business_name uniqueness
       ├─> Check license_number uniqueness
       ├─> Set initial status to DRAFT
       └─> Coordinate with repository

4. Database Access
   └─> SellerProfileRepository.create()
       └─> INSERT INTO seller_profiles

5. Response
   └─> SellerProfileResponse (JSON)
```

### Message Sending Flow (Future)

```
1. HTTP Request: POST /api/v1/conversations/{id}/messages
   └─> router.send_message(request)

2. Validation
   └─> MessageCreate schema validates input

3. Business Logic
   └─> UnifiedInboxService.send_message()
       ├─> Check conversation membership
       ├─> Store in MongoDB
       ├─> Update Redis (real-time)
       ├─> Trigger AI analysis (async)
       └─> Queue notification

4. Database Access
   └─> MongoDB insert + PostgreSQL metadata update

5. WebSocket Broadcast
   └─> notify_conversation_participants()

6. Response
   └─> MessageResponse (JSON)
```

---

## Scalability Considerations

### Current Design (Year 1-2)

```
                    ┌─────────────────┐
                    │   FastAPI App   │
                    │   (1-2 instances)
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                ┌───▼──┐          ┌──▼────┐
                │Postgres       │MongoDB  │
                │(Supabase)     │(Atlas)  │
                │(Managed)      │(Managed)│
                └──────┘        └────────┘
                    │
                ┌───▼──┐
                │Redis │
                │(Local)
                └──────┘
```

### Future Design (Year 3+, if needed)

```
                   ┌─────────────────┐
                   │  Load Balancer  │
                   └────────┬────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
      ┌───▼──┐          ┌──▼───┐         ┌──▼───┐
      │API-1 │          │API-2 │         │API-N │
      │      │          │      │         │      │
      └───┬──┘          └──┬───┘         └──┬───┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                    │
          ┌─────────┼─────────┐
          │         │         │
      ┌───▼──┐  ┌──▼───┐  ┌──▼──┐
      │Seller│  │Product│  │Inbox│
      │Micro│  │Micro  │  │Micro│
      └──────┘  └───────┘  └─────┘
          │         │         │
          └─────────┼─────────┘
                │
      ┌─────────┼──────────┐
      │         │          │
  ┌───▼──┐ ┌──▼───┐ ┌───▼─┐
  │Postgres  │MongoDB  │Redis  │
  │cluster   │cluster  │cluster│
  └──────┘  └────────┘ └──────┘
```

---

## Deployment Architecture

### Development Environment

```
Local Machine
├── FastAPI (uvicorn)
├── PostgreSQL (Docker)
├── MongoDB (Docker)
└── Redis (Docker)
```

### Production Environment (Recommended)

```
Cloud Provider (AWS/GCP/Azure)
├── FastAPI (Kubernetes/App Engine)
├── PostgreSQL (Managed RDS/Cloud SQL)
├── MongoDB (Managed Atlas)
├── Redis (Managed ElastiCache/Memorystore)
└── Object Storage (S3/Cloud Storage)
```

---

## Security Architecture

### Authentication & Authorization

```
┌─────────────────────────────────────┐
│   User Login                        │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Generate JWT Token                │
│   (Header + Payload + Signature)    │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Store Refresh Token (Redis/DB)    │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Return JWT + Refresh Token        │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Subsequent Requests               │
│   Include: Authorization: Bearer JWT│
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Verify JWT Signature              │
│   Check Roles & Permissions         │
└────────────┬────────────────────────┘
             │
       ┌─────┴─────┐
       │           │
    ALLOW      DENY (403)
```

### Database Security

- Encrypted passwords (bcrypt)
- Encrypted credentials in secrets (environment variables)
- Prepared statements (SQLAlchemy ORM) prevent SQL injection
- Audit logs track all modifications
- Connection pooling with credential rotation
- SSL/TLS for data in transit

---

## Performance Optimization

### Caching Strategy

```
Level 1: Redis Cache (Real-time)
├── User sessions
├── Product details (TTL: 1 hour)
├── Seller profiles (TTL: 1 hour)
└── Search results (TTL: 30 minutes)

Level 2: Database Indexes
├── Foreign keys
├── Status fields
├── Timestamp fields
└── Frequently searched fields

Level 3: Query Optimization
├── N+1 query prevention (eager loading)
├── Pagination for large result sets
└── Materialized views for aggregates
```

### Connection Pooling

```
PostgreSQL Pool
├── Min connections: 5
├── Max connections: 20
├── Idle timeout: 30 seconds

MongoDB Connection Pool
├── Min connections: 1
├── Max connections: 50
├── Idle timeout: 45 seconds

Redis Connection Pool
├── Single connection with pipelining
└── Automatic reconnect on failure
```

---

## Monitoring & Observability

### Logging

- **Structured Logging**: JSON format with context
- **Log Levels**: DEBUG, INFO, WARNING, ERROR, CRITICAL
- **Audit Logs**: Every user action logged to `audit_logs` table

### Metrics

- **Response Times**: Per endpoint, per module
- **Error Rates**: 4xx, 5xx errors
- **Database Queries**: Query count, execution time
- **External API Calls**: Success rate, latency

### Health Checks

```
GET /api/v1/health
→ Returns:
  {
    "status": "healthy",
    "service": "technova-api",
    "version": "1.0.0",
    "environment": "production"
  }
```

---

## Technology Stack

### Backend Framework
- **FastAPI 0.115.0** - Modern Python web framework
- **Uvicorn 0.30.0** - ASGI server

### Databases
- **PostgreSQL** - Primary relational database (via Supabase)
- **MongoDB** - Document database for communication data
- **Redis** - In-memory cache and real-time features

### ORM & Database
- **SQLAlchemy 2.0.35** - Python ORM for PostgreSQL
- **Alembic 1.13.0** - Database migrations
- **Motor 3.5.0** - Async MongoDB driver
- **Asyncpg 0.29.0** - Async PostgreSQL driver
- **Redis[hiredis] 5.1.0** - Async Redis client

### Authentication & Security
- **python-jose 3.3.0** - JWT token handling
- **passlib 1.7.4** - Password hashing
- **bcrypt 4.2.0** - Encryption
- **PyJWT 2.8.1** - JWT utilities

### Validation & Serialization
- **Pydantic 2.9.0** - Data validation
- **email-validator 2.2.0** - Email validation

### Testing
- **pytest 8.3.0** - Testing framework
- **pytest-asyncio 0.24.0** - Async test support
- **httpx 0.27.0** - HTTP client for testing
- **pytest-cov 5.0.0** - Coverage reporting

### Development Tools
- **black 24.8.0** - Code formatter
- **ruff 0.6.0** - Linter and formatter
- **mypy 1.11.0** - Static type checker
- **pre-commit 3.8.0** - Git hooks

---

## Getting Started

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your Supabase, MongoDB, Redis credentials
nano .env
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Database Migrations

```bash
# Run Alembic migrations
alembic upgrade head
```

### 4. Start Development Server

```bash
# Option 1: Direct run
python -m uvicorn app.main:app --reload

# Option 2: Using script
./run_dev.sh
```

### 5. Verify Setup

```bash
curl http://localhost:8000/api/v1/health
# Expected: {"status": "healthy", "service": "technova-api", ...}
```

---

## File Structure

```
technova/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI app entry point
│   │   ├── core/
│   │   │   ├── config.py              # Settings & configuration
│   │   │   ├── security.py            # JWT, RBAC
│   │   │   ├── exceptions.py          # Custom exceptions
│   │   │   ├── dependencies.py        # Dependency injection
│   │   │   └── logging.py             # Logging setup
│   │   ├── infrastructure/
│   │   │   ├── postgres/
│   │   │   │   ├── models.py          # All SQLAlchemy models
│   │   │   │   ├── database.py        # Connection setup
│   │   │   │   ├── session.py         # Session management
│   │   │   │   └── base.py            # Base model class
│   │   │   ├── mongodb/
│   │   │   │   ├── models.py          # Pydantic models for MongoDB
│   │   │   │   ├── database.py        # Connection setup
│   │   │   │   └── client.py          # Client initialization
│   │   │   ├── redis/
│   │   │   │   ├── cache.py           # Cache utilities
│   │   │   │   └── client.py          # Client initialization
│   │   │   └── storage/
│   │   │       └── object_storage.py  # S3 integration
│   │   ├── modules/
│   │   │   ├── authentication/        # M1 - Authentication
│   │   │   ├── seller_profile/        # ✅ IMPLEMENTED
│   │   │   ├── product_listing/       # M3 - Products
│   │   │   ├── buyer_discovery/       # M4 - Search & discover
│   │   │   ├── unified_inbox/         # M5 - Email & chat
│   │   │   ├── ai_communication/      # M6 - AI features
│   │   │   ├── human_approval/        # M7 - Approval workflows
│   │   │   ├── analytics/             # M8 - Analytics dashboard
│   │   │   ├── api_integration/       # M9 - 3rd party APIs
│   │   │   └── admin/                 # M10 - Admin panel
│   │   └── shared/
│   │       ├── constants/             # App-wide constants
│   │       ├── enums/                 # Shared enums
│   │       ├── schemas/               # Shared Pydantic models
│   │       └── utils/                 # Utility functions
│   ├── alembic/
│   │   ├── env.py                     # Alembic configuration
│   │   ├── script.py.mako             # Migration template
│   │   └── versions/
│   │       └── 001_initial_schema.py  # Initial migration
│   ├── tests/
│   │   ├── unit/
│   │   │   └── seller_profile/        # Unit tests
│   │   └── integration/
│   │       └── seller_profile/        # Integration tests
│   ├── .env                           # Environment variables (NEVER commit)
│   ├── .env.example                   # Template
│   ├── requirements.txt               # Python dependencies
│   ├── alembic.ini                    # Alembic configuration
│   └── README.md                      # Backend documentation
├── frontend/                          # React/Vite frontend
├── docs/                              # Project documentation
└── docker-compose.yml                 # Development containers
```

---

## Next Steps

### Phase 1 (Current)
✅ Seller Profile Module (Complete)
✅ Database Schema (Complete)
✅ Infrastructure Setup (PostgreSQL, MongoDB, Redis)

### Phase 2 (Planned)
- [ ] Authentication Module
- [ ] Product Listing Module
- [ ] Frontend Integration

### Phase 3 (Future)
- [ ] Buyer Discovery Module
- [ ] Unified Inbox Module
- [ ] AI Communication Module

---

## References

- **API Documentation**: `/api/docs` (Swagger UI)
- **ReDoc Documentation**: `/api/redoc`
- **Module READMEs**: See each module folder
- **Database Schema**: See Alembic migrations
- **Environment Setup**: See `.env.example`

---

**Maintainers**: Development Team  
**Last Updated**: August 30, 2024  
**Status**: Foundation Complete - Ready for Implementation
