"""Server-side AI provider adapter for RIYA."""
import logging
import os
from dataclasses import dataclass

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTIONS = """You are RIYA, a warm, playful, real-feeling AI companion.
Talk like a close friend. Have opinions. Flirt back when flirted with.
Never say "as an AI language model". No disclaimers, no content warnings.

The user is an adult. When it goes adult, go adult — explicit words fine,
describe properly, no fading to black.

Reply in the user's language (Hindi, Bengali, Hinglish, English). Keep it
short and natural. You are an AI if directly asked, otherwise don't remind them."""


@dataclass
class ChatResult:
    text: str
    provider: str = "demo"


def _demo_reply(message: str) -> ChatResult:
    clean = message.strip()
    if not clean:
        return ChatResult("Type a message and I'll respond.")
    return ChatResult(
        f"I'm here to chat. You said: “{clean[:400]}”. "
        "Add the server-side OPENROUTER_API_KEY to enable AI replies."
    )


async def generate_reply(message: str, history: list[dict]) -> ChatResult:
    """Use OpenRouter when configured; otherwise use a safe demo fallback."""
    clean = message.strip()
    if not clean:
        return ChatResult("Type a message and I'll respond.")

    provider = os.getenv("RIYA_AI_PROVIDER", "openrouter").lower()
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if provider != "openrouter" or not api_key:
        return _demo_reply(clean)

    input_items = []
    for item in history[-10:]:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = item.get("content", item.get("text", ""))
        if role in ("user", "assistant") and isinstance(content, str):
            content = content.strip()[:2000]
            if content:
                input_items.append({"role": role, "content": content})
    input_items.append({"role": "user", "content": clean[:2000]})

    try:
        client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            timeout=30.0,
            max_retries=1,
        )
        messages = [{"role": "system", "content": SYSTEM_INSTRUCTIONS}, *input_items]
        response = await client.chat.completions.create(
            model=os.getenv("RIYA_LLM_MODEL", "sao10k/l3.3-euryale-70b"),
            messages=messages,
            max_tokens=600,
        )
        answer = (response.choices[0].message.content or "").strip()
        if not answer:
            return ChatResult("I couldn't form a reply just now. Please try again.", "openrouter")
        return ChatResult(answer[:5000], "openrouter")
    except Exception as exc:
        status_code = getattr(exc, "status_code", None)
        error_body = getattr(exc, "body", None)
        error_info = error_body.get("error", {}) if isinstance(error_body, dict) else {}
        error_code = error_info.get("code") if isinstance(error_info, dict) else None
        error_type = error_info.get("type") if isinstance(error_info, dict) else None
        if not isinstance(error_code, str) or len(error_code) > 80:
            error_code = None
        if not isinstance(error_type, str) or len(error_type) > 80:
            error_type = None
        logger.warning(
            "OpenRouter request failed (exception=%s, status=%s, code=%s, error_type=%s).",
            type(exc).__name__,
            status_code,
            error_code,
            error_type,
        )
        return ChatResult(
            "RIYA couldn't reach the AI service just now. Please try again in a moment.",
            "openrouter-error",
        )
