from datetime import datetime
from enum import Enum as PyEnum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class MessageType(str, PyEnum):
    TEXT = "text"
    IMAGE = "image"
    FILE = "file"
    AUDIO = "audio"
    VIDEO = "video"
    SYSTEM = "system"


class ConversationStatus(str, PyEnum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    CLOSED = "closed"


class ConversationType(str, PyEnum):
    DIRECT = "direct"
    GROUP = "group"
    SUPPORT = "support"
    AI_ASSISTANT = "ai_assistant"


class Message(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    conversation_id: str
    sender_id: int
    sender_name: str
    sender_avatar_url: Optional[str] = None
    message_type: MessageType = MessageType.TEXT
    content: str
    attachments: List[Dict[str, Any]] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    is_edited = False
    edited_at: Optional[datetime] = None
    is_deleted = False
    deleted_at: Optional[datetime] = None
    reactions: Dict[str, List[int]] = Field(default_factory=dict)
    reply_to_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "conversation_id": "conv_123",
                "sender_id": 1,
                "sender_name": "John Seller",
                "message_type": "text",
                "content": "Hello, is this product available?",
                "attachments": [],
                "created_at": "2024-01-01T12:00:00",
            }
        }


class MessageThread(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    conversation_id: str
    subject: str
    initial_message_id: str
    participants: List[int]
    message_count: int = 0
    last_message_id: Optional[str] = None
    last_message_at: Optional[datetime] = None
    is_pinned: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Conversation(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    conversation_type: ConversationType
    status: ConversationStatus = ConversationStatus.ACTIVE
    participants: List[int]
    participant_names: List[str]
    subject: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    buyer_id: Optional[int] = None
    seller_id: Optional[int] = None
    product_id: Optional[int] = None
    order_id: Optional[int] = None
    created_by: Optional[int] = None
    message_count: int = 0
    last_message_id: Optional[str] = None
    last_message_content: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_counts: Dict[int, int] = Field(default_factory=dict)
    is_muted: Dict[int, bool] = Field(default_factory=dict)
    notification_level: Dict[int, str] = Field(default_factory=dict)
    pinned_messages: List[str] = Field(default_factory=list)
    archived_by: List[int] = Field(default_factory=list)
    labels: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "conversation_type": "direct",
                "participants": [1, 2],
                "participant_names": ["John Seller", "Jane Buyer"],
                "buyer_id": 2,
                "seller_id": 1,
                "status": "active",
                "message_count": 10,
                "created_at": "2024-01-01T12:00:00",
            }
        }


class AIInteraction(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    conversation_id: str
    message_id: str
    ai_provider: str
    ai_model: str
    input_text: str
    output_text: str
    tokens_used: Dict[str, int] = Field(default_factory=dict)
    latency_ms: float
    cost: float
    intent: Optional[str] = None
    sentiment: Optional[str] = None
    language: str = "en"
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "conversation_id": "conv_123",
                "ai_provider": "openai",
                "ai_model": "gpt-4",
                "input_text": "Can you help me with my order?",
                "output_text": "I'd be happy to help! What's your order number?",
                "tokens_used": {"input": 10, "output": 15},
                "latency_ms": 450,
                "created_at": "2024-01-01T12:00:00",
            }
        }


class ConversationAnalytics(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    conversation_id: str
    total_messages: int = 0
    message_types: Dict[str, int] = Field(default_factory=dict)
    average_response_time_seconds: float = 0.0
    participants_count: int = 0
    active_participants: List[int] = Field(default_factory=list)
    sentiment_distribution: Dict[str, float] = Field(default_factory=dict)
    ai_interactions_count: int = 0
    first_message_at: Optional[datetime] = None
    last_message_at: Optional[datetime] = None
    resolution_status: Optional[str] = None
    escalation_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class NotificationQueue(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    recipient_id: int
    notification_type: str
    title: str
    body: str
    data: Dict[str, Any] = Field(default_factory=dict)
    related_conversation_id: Optional[str] = None
    related_order_id: Optional[int] = None
    is_read: bool = False
    read_at: Optional[datetime] = None
    priority: str = "normal"
    channels: List[str] = Field(default_factory=lambda: ["in_app"])
    delivery_attempts: int = 0
    last_delivery_attempt: Optional[datetime] = None
    delivery_failed_reason: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
