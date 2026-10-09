"""Shared Groq client — one reusable AsyncGroq instance for every AI-backed
module (sentiment/drafts, guided-buying assistant, recommendations,
negotiation copy, and later voice/translation) instead of each module
re-implementing client setup.

Callers pick a tier, not a model id: ``fast=True`` routes to
``GROQ_MODEL_FAST`` for high-volume, low-stakes text; everything else uses
``GROQ_MODEL``.
"""
import json
from typing import Optional

from app.core.config import settings
from app.core.logging import logger

_groq_client = None
_groq_unavailable = False

# Reasoning models spend hidden reasoning tokens out of the same max_tokens
# budget as the visible answer; without a low effort a short budget can come
# back empty and silently drop every caller to its fallback.
_REASONING_MODEL_PREFIXES = ("openai/gpt-oss", "qwen/")


def get_groq_client():
    """Lazily create a single reusable AsyncGroq client (or None if unusable)."""
    global _groq_client, _groq_unavailable
    if _groq_client is not None or _groq_unavailable:
        return _groq_client
    if not settings.GROQ_API_KEY:
        _groq_unavailable = True
        return None
    try:
        from groq import AsyncGroq
    except Exception:
        logger.warning("groq package not installed; AI features degrade to heuristics/templates")
        _groq_unavailable = True
        return None
    _groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY, timeout=15.0)
    return _groq_client


def _model_kwargs(fast: bool) -> dict:
    model = settings.GROQ_MODEL_FAST if fast else settings.GROQ_MODEL
    kwargs = {"model": model}
    if model.startswith(_REASONING_MODEL_PREFIXES):
        kwargs["reasoning_effort"] = "low"
    return kwargs


async def _complete(system_prompt: str, user_prompt: str, *, fast: bool, **params) -> Optional[str]:
    client = get_groq_client()
    if client is None:
        return None
    response = await client.chat.completions.create(
        **_model_kwargs(fast),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        **params,
    )
    text = (response.choices[0].message.content or "").strip()
    return text or None


async def chat(
    system_prompt: str, user_prompt: str, *,
    temperature: float = 0.7, max_tokens: int = 300, fast: bool = False,
) -> Optional[str]:
    """Free-text Groq completion. Returns None (never raises) if Groq is
    unavailable or the call fails — callers fall back to a heuristic/template."""
    try:
        return await _complete(
            system_prompt, user_prompt, fast=fast,
            temperature=temperature, max_tokens=max_tokens,
        )
    except Exception:
        logger.warning("Groq chat completion failed", exc_info=True)
        return None


async def chat_json(
    system_prompt: str, user_prompt: str, *,
    temperature: float = 0.2, max_tokens: int = 400, fast: bool = False,
) -> Optional[dict]:
    """Groq completion constrained to a JSON object response. Returns None
    (never raises) on unavailability, failure, or unparsable output."""
    try:
        text = await _complete(
            system_prompt, user_prompt, fast=fast,
            temperature=temperature, max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        return json.loads(text) if text else None
    except Exception:
        logger.warning("Groq JSON completion failed", exc_info=True)
        return None
