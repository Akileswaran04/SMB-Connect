# 🔒 TECHNOVA Backend - Security Best Practices Guide

## Quick Reference

### ✅ DO:
- ✅ Store all secrets in `.env` file
- ✅ Use environment variables for configuration
- ✅ Follow the `.env.example` template
- ✅ Review changes before committing
- ✅ Use bcrypt for password hashing
- ✅ Use JWT tokens for authentication
- ✅ Log to structured logger (not stdout)
- ✅ Rotate secrets regularly
- ✅ Use HTTPS in production

### ❌ DON'T:
- ❌ Commit `.env` file to git
- ❌ Hardcode passwords or API keys
- ❌ Log sensitive data (passwords, tokens)
- ❌ Share credentials via email/chat
- ❌ Use `print()` for debugging with secrets
- ❌ Commit database backups
- ❌ Use HTTP in production
- ❌ Skip input validation
- ❌ Trust user input
- ❌ Disable CORS for security

---

## 🔐 Managing Secrets

### Setup

1. **Copy the template**:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. **Fill in your actual credentials**:
   ```bash
   # Edit backend/.env
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@...
   MONGODB_URI=mongodb+srv://username:password@...
   REDIS_URL=redis://username:password@...
   SECRET_KEY=generate-a-random-secret-key
   ```

3. **Never commit `.env`**:
   ```bash
   # Verify it's in .gitignore
   grep "backend/.env" .gitignore
   
   # Check if it's already tracked (should be empty)
   git ls-files | grep "backend/.env"
   ```

4. **Verify it's not in git history**:
   ```bash
   # Should show no results
   git log -p -- "backend/.env"
   ```

### Rotation Schedule

**Every 90 Days**:
- [ ] Rotate DATABASE_URL password in Supabase
- [ ] Rotate MONGODB_URI password in Atlas
- [ ] Rotate REDIS_URL password if applicable
- [ ] Rotate SECRET_KEY for JWT signing
- [ ] Rotate API keys (Gmail, OpenAI, etc.)

**Immediately (If Compromised)**:
- [ ] Disable/rotate compromised secret
- [ ] Review git history for exposure
- [ ] Audit access logs
- [ ] Notify team and users if needed

---

## 🔑 Database Credentials

### PostgreSQL (Supabase)

**✅ SECURE Way**:
```python
# .env file (NOT in git)
DATABASE_URL=postgresql://postgres:STRONG_PASSWORD@<YOUR_SUPABASE_HOST>.supabase.co:5432/postgres

# Python code
from app.core.config import settings
database_url = settings.DATABASE_URL  # Loaded from .env
```

**❌ INSECURE Way**:
```python
# NEVER do this!
DATABASE_URL = "postgresql://postgres:password@localhost:5432/db"
connection = asyncpg.connect(DATABASE_URL)  # Hardcoded!
```

### MongoDB (Atlas)

**✅ SECURE Way**:
```python
# .env file
MONGODB_URI=mongodb+srv://<YOUR_MONGODB_USER>:PASSWORD@<YOUR_MONGODB_CLUSTER>.mongodb.net

# Python code
from motor.motor_asyncio import AsyncClient
client = AsyncClient(settings.MONGODB_URI)
```

**❌ INSECURE Way**:
```python
# NEVER hardcode credentials!
MONGODB_URI = "mongodb+srv://user:pass@cluster.mongodb.net"
client = AsyncClient(MONGODB_URI)
```

### Redis

**✅ SECURE Way**:
```python
# .env file
REDIS_URL=redis://default:PASSWORD@<YOUR_REDIS_HOST>:<YOUR_REDIS_PORT>

# Python code
import redis.asyncio
client = redis.from_url(settings.REDIS_URL)
```

---

## 🔐 API Keys

### External Service Keys

**Gmail, OpenAI, etc.**:

**✅ SECURE Way**:
```python
# .env file (never committed)
GMAIL_API_KEY=AIzaSyD...
OPENAI_API_KEY=sk-proj-...
HUGGINGFACE_API_KEY=hf_...

# Python code
class Settings(BaseSettings):
    GMAIL_API_KEY: str = os.getenv("GMAIL_API_KEY")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY")
    
    # Usage:
    response = openai.ChatCompletion.create(
        api_key=self.OPENAI_API_KEY,
        model="gpt-4",
        messages=[...]
    )
```

**❌ INSECURE Way**:
```python
# NEVER hardcode!
OPENAI_API_KEY = "sk-proj-abcd1234"
response = openai.ChatCompletion.create(
    api_key=OPENAI_API_KEY,  # Exposed in code!
    model="gpt-4",
    messages=[...]
)
```

### Supabase Keys

**Public vs Secret**:
```
.env file:
SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co  # Public OK
SUPABASE_KEY=sb_publishable_...                         # Public OK
SUPABASE_SECRET=sb_secret_...                           # MUST NOT expose
```

**Never expose SUPABASE_SECRET**:
- Don't log it
- Don't send it to client
- Don't commit it
- Use SUPABASE_KEY (public) in client-side code only

---

## 🔑 JWT Token Security

### Creating Tokens

**✅ SECURE Way**:
```python
from datetime import datetime, timedelta
from app.core.config import settings
from app.core.security import create_access_token

# Token created with SECRET_KEY from .env
def login(user_id: int):
    access_token = create_access_token(
        data={"user_id": user_id, "role": user.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}
```

**Implementation**:
```python
# backend/app/core/security.py
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=30)
    
    to_encode.update({"exp": expire})
    # ✅ Uses SECRET_KEY from environment
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
```

### Validating Tokens

**✅ SECURE Way**:
```python
from fastapi import Depends, HTTPException
from app.core.security import decode_access_token

async def get_current_user(
    authorization: str = Header(None)
) -> int:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing token")
    
    token = authorization.replace("Bearer ", "")
    payload = decode_access_token(token)
    
    if not payload or "user_id" not in payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return payload["user_id"]
```

### Token Storage (Frontend)

```javascript
// ✅ SECURE - Store in httpOnly cookie or memory
// httpOnly cookies (server sets, client can't access)
Set-Cookie: access_token=eyJ...; HttpOnly; Secure; SameSite=Strict

// ❌ INSECURE - localStorage (vulnerable to XSS)
localStorage.setItem('token', accessToken);
// An XSS attack can steal this: localStorage.getItem('token')
```

---

## 🔐 Password Security

### Hashing

**✅ SECURE Way**:
```python
from app.core.security import hash_password, verify_password

# Storing password
hashed_password = hash_password(user_password)  # Uses bcrypt
# Store hashed_password in database

# Verifying password (during login)
if verify_password(user_input_password, stored_hash):
    # Password matches
    login_user(user)
else:
    raise HTTPException(status_code=401, detail="Invalid password")
```

**Implementation**:
```python
# backend/app/core/security.py
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)  # ✅ bcrypt with salt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)  # ✅ Timing-safe
```

**❌ INSECURE Ways**:
```python
# ❌ Storing plaintext
user.password = user_input_password

# ❌ Using weak hashing (MD5)
import hashlib
user.password = hashlib.md5(user_input_password).hexdigest()

# ❌ Using weak hashing (SHA1)
user.password = hashlib.sha1(user_input_password).hexdigest()
```

### Password Requirements

**Enforce in validation**:
```python
from pydantic import BaseModel, Field

class UserCreate(BaseModel):
    email: str
    password: str = Field(..., min_length=12)  # At least 12 characters
    
    @field_validator('password')
    def password_strength(cls, v):
        if not any(c.isupper() for c in v):
            raise ValueError('Must contain uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Must contain digit')
        if not any(c in '!@#$%^&*' for c in v):
            raise ValueError('Must contain special character')
        return v
```

---

## 📝 Logging Best Practices

### ✅ SECURE Logging

```python
import structlog

logger = structlog.get_logger()

# ✅ OK - Log action without sensitive data
logger.info("user_login", user_id=user_id, ip=request.client.host)

# ✅ OK - Log error without sensitive data
logger.error("login_failed", user_id=user_id, reason="invalid_password")

# ✅ OK - Log with hashed sensitive data
logger.info("password_changed", user_id=user_id, hash=hash_password(old_password)[:10])
```

### ❌ INSECURE Logging

```python
# ❌ NEVER log plaintext password
logger.info(f"Login attempt: password={password}")

# ❌ NEVER log full token
logger.info(f"Token: {access_token}")

# ❌ NEVER log full API key
logger.info(f"OpenAI key: {OPENAI_API_KEY}")

# ❌ NEVER use print() for debugging with secrets
print(f"DEBUG: password={password}, api_key={api_key}")
```

---

## 🔒 HTTPS & TLS

### Development

```bash
# HTTP is OK for local development
http://localhost:8000
```

### Production

**✅ MUST USE HTTPS**:
```python
# Via environment
ENVIRONMENT=production
DEBUG=False

# Configure reverse proxy (Nginx, Cloudflare, etc.)
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/certificate.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8000;
    }
}
```

---

## 🛡️ CORS Security

### Development

```python
# .env
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
```

### Production

```python
# .env - Restrict to your domain only
CORS_ORIGINS=["https://app.technova.com","https://www.technova.com"]
```

**Never use wildcard**:
```python
# ❌ INSECURE
CORS_ORIGINS=["*"]  # Anyone can access your API

# ✅ SECURE
CORS_ORIGINS=["https://yourdomain.com"]
```

---

## 🔍 Input Validation

### ✅ ALWAYS Validate Input

```python
from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    email: EmailStr  # ✅ Validates email format
    username: str = Field(..., min_length=3, max_length=50)  # ✅ Length validation
    password: str = Field(..., min_length=12)  # ✅ Minimum length
    
# FastAPI automatically validates

# ❌ Never trust raw input
user = UserCreate(
    email=request.body.email,  # ❌ Not validated
    username=request.body.username,  # ❌ Could be anything
    password=request.body.password  # ❌ No validation
)
```

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Review `.env.example` - all placeholders documented
- [ ] Create `.env` with production credentials (never in git)
- [ ] Set `ENVIRONMENT=production`
- [ ] Set `DEBUG=False`
- [ ] Generate strong `SECRET_KEY` (min 32 chars)
- [ ] Rotate `SECRET_KEY` to new value from previous deployment
- [ ] Set `CORS_ORIGINS` to production domain only
- [ ] Enable HTTPS (SSL/TLS certificate)
- [ ] Update database credentials to production instances
- [ ] Enable audit logging
- [ ] Setup monitoring and alerting
- [ ] Document secret rotation schedule
- [ ] Train team on security best practices
- [ ] Run security audit before launch
- [ ] Setup backup and disaster recovery

---

## 📚 Reference Links

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Passlib Documentation](https://passlib.readthedocs.io/)
- [PyJWT Documentation](https://pyjwt.readthedocs.io/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Pydantic Validators](https://docs.pydantic.dev/latest/api/validators/)

---

## 🆘 Security Issues?

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. **DO NOT** discuss in public channels
3. **DO** contact security team privately
4. **DO** provide detailed reproduction steps
5. **DO** give maintainers time to fix before disclosure

---

**Last Updated**: August 30, 2026  
**Status**: ✅ Current  
**Review Cycle**: 90 days
