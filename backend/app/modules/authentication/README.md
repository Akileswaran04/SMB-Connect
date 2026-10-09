# Authentication Module

**Status**: PARTIAL (OAuth/JWT framework ready, implementation pending)

## Overview
Handles user authentication, authorization, session management, and multi-provider OAuth integration. Critical foundation for all other modules requiring authenticated access.

## Responsibilities
- User registration (email, phone, OAuth)
- User login and logout
- JWT token generation and validation
- Token refresh mechanism
- Password hashing, verification, and reset
- OAuth integration (Google, Microsoft, GitHub, etc.)
- Session management and invalidation
- Role-based access control (RBAC)
- Permission checks and decorators
- Email verification flow
- Multi-factor authentication (MFA) framework

## Planned API Endpoints
```
# Authentication
POST   /api/v1/auth/register              - Create new user account
POST   /api/v1/auth/login                 - Login with credentials
POST   /api/v1/auth/logout                - Logout current session
POST   /api/v1/auth/refresh-token         - Refresh access token
POST   /api/v1/auth/oauth/{provider}      - OAuth login
GET    /api/v1/auth/me                    - Get current user profile
PUT    /api/v1/auth/me                    - Update current user

# Password Management
POST   /api/v1/auth/change-password       - Change password (authenticated)
POST   /api/v1/auth/forgot-password       - Initiate password reset
POST   /api/v1/auth/reset-password        - Complete password reset
GET    /api/v1/auth/verify-email/:token   - Verify email address

# MFA (Future)
POST   /api/v1/auth/mfa/setup             - Enable MFA
POST   /api/v1/auth/mfa/verify            - Verify MFA code
POST   /api/v1/auth/mfa/disable           - Disable MFA
```

## Database
**Primary**: PostgreSQL

### Tables
- `users` - User accounts, credentials, OAuth
- `auth_sessions` (future) - Active sessions and tokens
- `oauth_connections` (future) - Multi-provider OAuth accounts
- `mfa_settings` (future) - MFA configuration

### Enums
- `UserRole`: ADMIN, SELLER, BUYER
- `OAuthProvider`: GOOGLE, MICROSOFT, GITHUB

## External Integrations
- **Google OAuth 2.0** - Gmail login, profile sync
- **Microsoft OAuth** - Office 365, Outlook integration
- **GitHub OAuth** - Developer login
- **Email Service** - Password reset, verification emails
- **SMS Service** (future) - OTP for 2FA

## Dependencies
- `python-jose[cryptography]` - JWT encoding/decoding
- `passlib[bcrypt]` - Secure password hashing
- `bcrypt` - Additional encryption
- `PyJWT` - JWT token handling
- `aiohttp` - Async HTTP for OAuth token exchange
- `email-validator` - Email validation

## Security Considerations
- Use HTTPS only for token transmission
- Store refresh tokens securely (httponly cookies)
- Implement rate limiting on login attempts
- Log authentication events in audit logs
- Enforce strong password policies
- Validate OAuth state parameters

## Future Enhancements
- Two-factor authentication (TOTP/SMS)
- Biometric authentication
- Device trust and recognition
- Login activity tracking
- Geographic login anomaly detection
- Account lockout after failed attempts
- Session revocation and device management
