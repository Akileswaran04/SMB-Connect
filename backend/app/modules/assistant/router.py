"""Assistant Router — HTTP endpoints only."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.infrastructure.redis.ratelimit import rate_limit
from app.modules.assistant.schemas import UnderstandRequest, UnderstandResponse, VoiceRequest, ChatRequest
from app.modules.assistant.service import AssistantService

# Every call here spends model tokens: signed-in users only, rate limited.
router = APIRouter(dependencies=[Depends(rate_limit(30, 60, "ai:assistant"))])


def _service(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> AssistantService:
    return AssistantService(db, user)


@router.post("/understand", response_model=UnderstandResponse)
async def understand(data: UnderstandRequest, service: AssistantService = Depends(_service)):
    """Guided-buying entry point: 'What are you looking for today?'"""
    return await service.understand(data)


@router.post("/chat")
async def chat(data: ChatRequest, service: AssistantService = Depends(_service)):
    """Action assistant: search, cheaper, similar, availability, delivery,
    compare, negotiate, message seller, track, reorder, product questions."""
    return await service.chat(data)


@router.post("/voice")
async def voice(data: VoiceRequest, service: AssistantService = Depends(_service)):
    """Voice entry point — the same assistant, replying in the shopper's language."""
    return await service.process_voice(data)
