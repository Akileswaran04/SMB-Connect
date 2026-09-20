# Unified Inbox Module

**Status**: NOT IMPLEMENTED (Planned for M5)

## Overview
Unifies communications across multiple channels (Email, In-app Chat, SMS) into a single inbox. Integrates with Gmail and Microsoft Graph for email synchronization and provides real-time messaging capabilities.

## Responsibilities
- Email integration and synchronization (Gmail, Outlook)
- In-app messaging system
- Message threading and conversation management
- Email deduplication and merging
- Real-time notifications and typing indicators
- Message search across all channels
- Conversation labels and organization
- Message scheduling and templates

## Planned API Endpoints
```
# Conversations
GET    /api/v1/conversations               - List all conversations
GET    /api/v1/conversations/{id}          - Get conversation details
POST   /api/v1/conversations               - Start new conversation
DELETE /api/v1/conversations/{id}          - Delete conversation
PATCH  /api/v1/conversations/{id}/status   - Archive/unarchive

# Messages
GET    /api/v1/conversations/{id}/messages - Get messages in conversation
POST   /api/v1/conversations/{id}/messages - Send message
PUT    /api/v1/messages/{id}               - Edit message
DELETE /api/v1/messages/{id}               - Delete message

# Email Integration
POST   /api/v1/mail/connect/gmail          - Connect Gmail account
POST   /api/v1/mail/connect/microsoft      - Connect Microsoft account
GET    /api/v1/mail/accounts                - List connected email accounts
POST   /api/v1/mail/sync                    - Manual sync trigger

# WebSocket (Real-time)
WS     /ws/conversations/{id}              - Real-time message stream
WS     /ws/typing                          - Typing indicators
```

## Database
**Primary**: PostgreSQL (conversation metadata)
**Secondary**: MongoDB (messages, threads, email sync logs)
**Real-time**: Redis (online status, typing indicators, pub/sub)

### Tables (PostgreSQL)
- `conversations` - Conversation metadata
- `conversation_participants` - Participants in each conversation

### Collections (MongoDB)
- `messages` - Individual messages with full content
- `message_threads` - Threaded conversations
- `email_sync_logs` - Email synchronization history
- `ai_interactions` - AI-processed email data

### Redis Keys
- `online_users:{id}` - Online status
- `typing:{conversation_id}` - Current typers

## External Integrations
- **Gmail API** - Email fetch, send, labels
- **Microsoft Graph API** - Outlook/Exchange integration
- **SMS Gateway** (future) - SMS support
- **Twilio** (future) - Phone integration
- **AI Communication Module** - Smart reply suggestions

## Key Features
- Unified inbox for multiple email accounts
- Real-time message sync
- Conversation threading
- Email-to-chat bridge
- Message search with filters
- Email labels as conversation labels

## Future Enhancements
- SMS integration
- WhatsApp integration
- Video call support
- Screen sharing
- Message encryption
- Message reactions and emoji support
- File sharing and preview
- Email signature management
- Auto-reply and vacation mode
