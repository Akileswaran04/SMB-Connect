import logging
import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ValidationException, NotFoundException, ConflictException
from app.infrastructure.redis import RedisClient
from app.infrastructure.redis.realtime import RealtimeService
from app.infrastructure.mongodb.chat import utcnow
from app.modules.seller_profile.models import User, SellerProfile
from app.modules.buyer_profile.models import BuyerProfile
from app.modules.unified_inbox.repository import ConversationRepository, MessageRepository
from app.modules.ai_communication.sentiment import analyze_message
from app.modules.api_integration.models import ApiToken

logger = logging.getLogger(__name__)

SERVICES = ("gmail", "outlook")

OAUTH_STATE_TTL = 600

SAMPLE_EMAILS = {
    "gmail": [
        ("buyer", "Hi, I saw your store on the marketplace — do you ship to Delhi?"),
        ("buyer", "Could you also let me know if you can do a small bulk discount for 10 units?"),
    ],
    "outlook": [
        ("buyer", "Hello! Received my order yesterday — the packaging was great, thank you!"),
        ("buyer", "Will you be restocking the item I bought? I'd like to order more next month."),
    ],
}

SERVICE_LABELS = {"gmail": "Google Mail", "outlook": "Microsoft Outlook"}


class IntegrationService:
    def __init__(self, db: AsyncSession):
        self.db = db


    async def connect(self, user: User, service: str) -> dict:
        service = self._check_service(service)
        if user.role != "seller":
            raise ValidationException("Only sellers can connect external inboxes")

        existing = await self._get_token(user.id, service)
        if existing and existing.is_active:
            raise ConflictException(f"{SERVICE_LABELS[service]} is already connected")

        state = secrets.token_urlsafe(32)
        await RedisClient.set_cache(f"oauth:state:{state}", f"{user.id}:{service}", ttl=OAUTH_STATE_TTL)

        client_id, redirect_uri = self._provider_config(service)
        if client_id:
            auth_url = self._build_real_auth_url(service, client_id, redirect_uri, state)
            mode = "oauth"
        else:
            base = settings.PUBLIC_BASE_URL.rstrip("/")
            auth_url = (
                f"{base}/api/v1/integrations/{service}/callback"
                f"?code=mock-{state}&state={state}"
            )
            mode = "mock"

        return {"service": service, "auth_url": auth_url, "state": state, "mode": mode}

    async def callback(self, service: str, code: str, state: str) -> dict:
        service = self._check_service(service)
        if not code or not state:
            raise ValidationException("code and state are required")

        bound = await RedisClient.get_cache(f"oauth:state:{state}")
        if not bound:
            raise ValidationException("Invalid or expired OAuth state — start a new connect flow")
        try:
            user_id_str, bound_service = bound.split(":", 1)
            user_id = int(user_id_str)
        except (ValueError, AttributeError):
            raise ValidationException("Invalid OAuth state payload")
        if bound_service != service:
            raise ValidationException("OAuth state does not match the requested service")
        await RedisClient.delete_cache(f"oauth:state:{state}")

        provider_account, scopes, expires_at = self._exchange_code(service, code)
        token = await self._upsert_token(user_id, service, code, provider_account, scopes, expires_at)
        return {
            "service": service,
            "connected": True,
            "provider_account": token.provider_account,
            "expires_at": token.expires_at.isoformat() if token.expires_at else None,
        }

    def _exchange_code(self, service: str, code: str):
        client_id, redirect_uri = self._provider_config(service)
        if client_id and not code.startswith("mock-"):
            logger.warning("Real OAuth exchange not configured for %s — storing code ref", service)
            return f"account@{service}.example.com", "offline_access", utcnow() + timedelta(days=30)

        account = f"demo.{service}@example.com" if code.startswith("mock-") else f"account@{service}.example.com"
        scopes = "gmail.readonly" if service == "gmail" else "offline_access Mail.Read"
        return account, scopes, utcnow() + timedelta(days=30)


    async def list_integrations(self, user: User) -> list[dict]:
        rows = await self._get_tokens(user.id)
        by_service = {r.service: r for r in rows}
        items = []
        for service in SERVICES:
            row = by_service.get(service)
            items.append({
                "service": service,
                "connected": bool(row and row.is_active),
                "provider_account": row.provider_account if row else None,
                "scopes": row.scopes if row else None,
                "expires_at": row.expires_at.isoformat() if row and row.expires_at else None,
            })
        return items

    async def disconnect(self, user: User, service: str) -> dict:
        service = self._check_service(service)
        result = await self.db.execute(
            select(ApiToken).where(ApiToken.user_id == user.id, ApiToken.service == service)
        )
        token = result.scalar_one_or_none()
        if not token:
            raise NotFoundException("Integration", service)
        await self.db.delete(token)
        await self.db.commit()
        return {"service": service, "connected": False}


    async def sync(self, user: User, service: str) -> dict:
        service = self._check_service(service)
        token = await self._get_token(user.id, service)
        if not token or not token.is_active:
            raise ValidationException(f"{SERVICE_LABELS[service]} is not connected — connect it first")

        profile_result = await self.db.execute(select(SellerProfile).where(SellerProfile.user_id == user.id))
        seller_profile = profile_result.scalar_one_or_none()
        if not seller_profile:
            raise NotFoundException("SellerProfile", str(user.id))

        buyer_profile = await self._pick_buyer(seller_profile.id)
        if not buyer_profile:
            raise ValidationException("No buyers exist to sync an email conversation with")

        convo_repo = ConversationRepository()
        msg_repo = MessageRepository()
        convo = await convo_repo.get_or_create(seller_profile.id, buyer_profile.id)

        created = 0
        message_ids = []
        for i, (_, content) in enumerate(SAMPLE_EMAILS[service], start=1):
            client_message_id = f"email-{service}-{seller_profile.id}-{i}"
            existing = await msg_repo.find_by_client_message_id(client_message_id)
            if existing:
                continue
            sequence = await msg_repo.next_sequence(str(convo["_id"]))
            doc = {
                "conversationId": convo["_id"],
                "senderId": buyer_profile.id,
                "senderType": "buyer",
                "senderName": None,
                "content": content,
                "messageType": "text",
                "source": service,
                "sentiment": await analyze_message(content),
                "sequenceNumber": sequence,
                "attachments": [],
                "createdAt": utcnow(),
                "readAt": None,
                "isAiGenerated": False,
                "clientMessageId": client_message_id,
            }
            saved = await msg_repo.create(doc)
            await convo_repo.update_last_message(str(convo["_id"]), content, seller_profile.id)
            await convo_repo.increment_unread(str(convo["_id"]), seller_profile.id)
            message_ids.append(str(saved["_id"]))
            created += 1

        if created:
            await RealtimeService.publish(
                str(convo["_id"]), "message:new",
                {"message": {"conversation_id": str(convo["_id"]), "source": service, "sync": True}},
            )

        note = None if created else "No new messages to sync (already synced or empty inbox)"
        return {
            "service": service,
            "created": created,
            "source": service,
            "conversation_id": str(convo["_id"]),
            "message_ids": message_ids,
            "note": note,
        }

    async def _pick_buyer(self, seller_profile_id: int) -> Optional[BuyerProfile]:
        convos = await ConversationRepository().list_for_participant(seller_profile_id, "seller", limit=50)
        existing_buyer_ids = {c.get("buyerId") for c in convos[0]}
        result = await self.db.execute(
            select(BuyerProfile).where(BuyerProfile.id.in_(existing_buyer_ids)).order_by(BuyerProfile.id)
        )
        known = result.scalars().first()
        if known:
            return known
        result = await self.db.execute(select(BuyerProfile).order_by(BuyerProfile.id))
        return result.scalars().first()


    def _check_service(self, service: str) -> str:
        if service not in SERVICES:
            raise ValidationException(f"Unsupported service: {service} (use gmail or outlook)")
        return service

    def _provider_config(self, service: str) -> tuple[Optional[str], Optional[str]]:
        if service == "gmail":
            return settings.GMAIL_CLIENT_ID, settings.GMAIL_REDIRECT_URI
        return settings.MICROSOFT_CLIENT_ID, settings.MICROSOFT_REDIRECT_URI

    def _build_real_auth_url(self, service: str, client_id: str, redirect_uri: str, state: str) -> str:
        if service == "gmail":
            params = {
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "https://www.googleapis.com/auth/gmail.readonly",
                "state": state,
                "access_type": "offline",
                "prompt": "consent",
            }
            return "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "offline_access Mail.Read",
            "state": state,
        }
        return "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" + urllib.parse.urlencode(params)

    async def _get_token(self, user_id: int, service: str) -> Optional[ApiToken]:
        result = await self.db.execute(
            select(ApiToken).where(ApiToken.user_id == user_id, ApiToken.service == service)
        )
        return result.scalar_one_or_none()

    async def _get_tokens(self, user_id: int) -> list[ApiToken]:
        result = await self.db.execute(select(ApiToken).where(ApiToken.user_id == user_id))
        return list(result.scalars())

    async def _upsert_token(self, user_id: int, service: str, token_ref: str,
                            provider_account: str, scopes: str, expires_at) -> ApiToken:
        result = await self.db.execute(
            select(ApiToken).where(ApiToken.user_id == user_id, ApiToken.service == service)
        )
        token = result.scalar_one_or_none()
        now = utcnow()
        if token is None:
            token = ApiToken(
                user_id=user_id,
                service=service,
                token_ref=token_ref,
                provider_account=provider_account,
                scopes=scopes,
                expires_at=expires_at,
                is_active=True,
            )
            self.db.add(token)
        else:
            token.token_ref = token_ref
            token.provider_account = provider_account
            token.scopes = scopes
            token.expires_at = expires_at
            token.is_active = True
            token.updated_at = now
        await self.db.commit()
        await self.db.refresh(token)
        return token