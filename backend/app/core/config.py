
from pathlib import Path
from typing import List, Optional
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

_env_path = Path(__file__).resolve().parents[2] / ".env"
if _env_path.exists():
    load_dotenv(_env_path, override=True)


class Settings(BaseSettings):
    APP_NAME: str = "TECHNOVA"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    DATABASE_URL: str = "postgresql+asyncpg://technova:technova@localhost:5432/technova"
    DATABASE_ECHO: bool = False

    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "technova"

    REDIS_URL: str = "redis://localhost:6379"

    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"

    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    PUBLIC_BASE_URL: str = "http://localhost:8000"

    # With no SMS/email provider configured, OTP codes are returned in the API
    # response so the login flow can be used and tested. Turn off in production.
    OTP_DEV_MODE: bool = True
    OTP_TTL_SECONDS: int = 300
    OTP_MAX_ATTEMPTS: int = 5

    GROQ_API_KEY: Optional[str] = None
    # "smart" tier: understanding buyer requirements (any language incl.
    # Tamil/Tanglish), translation, comparisons. "fast" tier: high-volume,
    # low-stakes text such as seller reply drafts.
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    GROQ_MODEL_FAST: str = "openai/gpt-oss-20b"

    GMAIL_CLIENT_ID: Optional[str] = None
    GMAIL_CLIENT_SECRET: Optional[str] = None
    GMAIL_REDIRECT_URI: Optional[str] = None
    MICROSOFT_CLIENT_ID: Optional[str] = None
    MICROSOFT_CLIENT_SECRET: Optional[str] = None
    MICROSOFT_REDIRECT_URI: Optional[str] = None

    STORAGE_BUCKET: str = "technova-storage"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
