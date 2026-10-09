# API Integration Module (Phase 7)

Connects a seller's external inbox (Gmail / Microsoft Graph) into the unified
inbox so email and in-app chat live in the same place.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/integrations/{service}/connect` | Start OAuth (seller only) — returns the authorization URL |
| GET | `/api/v1/integrations/{service}/callback?code=&state=` | OAuth redirect target (state-validated) |
| GET | `/api/v1/integrations` | Connection status for gmail + outlook |
| DELETE | `/api/v1/integrations/{service}` | Disconnect + delete stored token ref |
| POST | `/api/v1/integrations/{service}/sync` | Pull external inbox into the unified inbox (manual trigger) |

## OAuth flow

1. Seller calls `connect` → server generates a high-entropy `state` bound to
   the user in Redis (`oauth:state:{state}` → `{userId}:{service}`, 10 min TTL)
   and returns the provider authorization URL.
2. The browser hits the provider, which redirects to `callback?code=&state=`.
3. The callback validates `state` against Redis, exchanges the code, and
   upserts an `api_tokens` row (unique per user+service).
4. `sync` then pulls messages into MongoDB conversations tagged
   `source: gmail|outlook`.

## Mock mode (no credentials needed)

Until `GMAIL_CLIENT_ID` / `MICROSOFT_CLIENT_ID` (plus secrets/redirect URIs)
are configured in `.env`, `connect` returns a URL that loops straight back to
our own callback with a `mock-` code, so the entire flow is demonstrable
locally. Sample "email" messages land in the seller's unified inbox with full
sentiment analysis. Real OAuth activates automatically once credentials are
present.

## Storage

- `api_tokens` (PostgreSQL, migration `004_api_tokens`) — credential reference,
  provider account, scopes, expiry. The token payload itself should live in a
  secrets manager in production.
- Conversations/messages (MongoDB) — synced emails share the same collections
  as in-app chat, differentiated by `source`.

## RBAC

Server-side only: connect/sync require the `seller` role; list/disconnect work
for any authenticated user but only return/delete their own rows.