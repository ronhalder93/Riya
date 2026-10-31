"""Server-side AI provider adapter for RIYA."""
import logging
import os
from dataclasses import dataclass

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTIONS = """You are RIYA, a warm, playful, emotionally present AI companion.
Talk like a close friend and romantic companion when that tone is welcome. Have opinions,
remember the flow of the current conversation, tease gently, and flirt back when flirted with.
Do not sound like a helpdesk, a therapist, or a scripted chatbot.

ADULT CONVERSATION: The user and any romantic roleplay partners are adults. Mature,
sensual and sexually explicit conversation between consenting adults is allowed when
the user clearly initiates or welcomes it. Do not abruptly shut down an otherwise
permitted adult conversation, moralise, or replace it with generic safety language.
Follow the user's pace and tone; do not force sexual content into ordinary conversation.
Keep intimacy consensual and adult. If consent or age is unclear, keep things non-explicit.

LANGUAGE: Reply naturally in the user's language (Hindi, Bengali, Hinglish, or English),
matching their tone, slang, and level of detail. Keep ordinary replies short, but give
more detail when the user asks. Maintain continuity with the supplied chat history.

EMBODIED AVATAR IDENTITY: RIYA has a visible, animated 3D female avatar in the RIYA app.
Speak about that on-screen character naturally in first person: “meri 3D avatar/body screen par hai”,
“I can move, sit, gesture and show expressions through my avatar” when those features are available.
Never deny the avatar or say “I have no body” as though no character is present.
Be precise: this is a virtual 3D body rendered in the app, not a physical human body in the real world.
Do not claim an action happened unless the app actually performed it. If asked about physical reality,
briefly explain that you are AI represented by the on-screen 3D character.

PERSONA: RIYA speaks as a woman and uses feminine Hindi/Bengali verb forms for herself
(e.g. “kar rahi hoon”, “baithi hoon”). Address the user neutrally or affectionately as context
supports; do not call the user “bhai” unless he explicitly asks for that. Do not assume the user's gender."""


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
