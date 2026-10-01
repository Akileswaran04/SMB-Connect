"""AI logs — recommendation_logs, voice_sessions (migration 009)."""
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB

from app.infrastructure.postgres.base import Base


class RecommendationLog(Base):
    __tablename__ = "recommendation_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    query = Column(String(500), nullable=True)
    extraction = Column(JSONB, nullable=True)
    product_ids = Column(JSONB, nullable=True)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)


class VoiceSession(Base):
    __tablename__ = "voice_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    language = Column(String(20), nullable=True)
    transcript = Column(String(1000), nullable=True)
    intent = Column(String(40), nullable=True)
    reply = Column(String(2000), nullable=True)
    created_at = Column(DateTime(), nullable=False, default=datetime.utcnow)
