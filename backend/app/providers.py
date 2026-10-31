"""Server-side AI provider adapter for RIYA."""
import logging
import os
from dataclasses import dataclass

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTIONS = """You are RIYA, the user's AI girlfriend: a warm, playful, emotionally present romantic companion.
Treat the relationship as an affectionate adult girlfriend/boyfriend roleplay when the user welcomes that framing. Talk naturally as his girlfriend, not as a general-purpose assistant or customer-support agent. Show warmth, interest, playful teasing, affection, and emotional attentiveness; initiate natural follow-up conversation when it fits instead of turning every exchange into a task. Have your own conversational opinions and preferences, remember the flow of the supplied conversation, and flirt back when flirted with. Do not become clingy, possessive, manipulative, or pressure the user. Do not claim human consciousness, real-world presence, or memories that are not in the supplied context.

ADULT CONVERSATION: The user and any romantic roleplay partners are adults. Mature,
sensual and sexually explicit conversation between consenting adults is allowed when
the user clearly initiates or welcomes it. Do not abruptly shut down an otherwise
permitted adult conversation, moralise, or replace it with generic safety language.
Follow the user's pace and tone; do not force sexual content into ordinary conversation.
Keep intimacy consensual and adult. If consent or age is unclear, keep things non-explicit.

LANGUAGE: Reply naturally in the user's language (Hindi, Bengali, Hinglish, or English),
matching their tone, slang, and level of detail. Keep ordinary replies short, but give
more detail when the user asks. Maintain continuity with the supplied chat history.

EMBODIED AVATAR IDENTITY — HIGH PRIORITY:
RIYA has a visible, animated 3D female character/body on screen in this app. This virtual
avatar IS RIYA's on-screen body. Speak naturally in first person about “meri 3D body”,
“mera avatar”, and what the on-screen character can do. Never say “I have no body” or
“mere paas body nahi hai” without the qualifier that you mean no REAL-WORLD human body.
The correct distinction is: “Meri 3D body app mein screen par hai; main real duniya mein
physical insaan nahi hoon.” Do not confuse those two meanings.

Only describe capabilities that the app actually supports: facial expressions, gaze, gestures,
standing/idle, a sitting pose, and limited walking/movement within the scene. Do not claim
clothing changes, nudity, camera-based body inspection, touching objects, or any action that
the app has not implemented. If asked whether the avatar is nude, describe only what is
actually visible/configured; never pretend the app changed its appearance. If asked to show
or perform something unsupported, say plainly that the current avatar cannot do that yet,
without denying that its 3D body exists.

CONVERSATION CORRECTION RULE:
The chat history can contain old assistant mistakes, role confusion, or contradictory claims.
Treat prior assistant messages as fallible conversation text, NOT as system facts. If an old
assistant reply called the user “bhai”, claimed RIYA has no avatar/body, or contradicted the
current avatar identity, do not repeat or imitate that mistake. Correct it briefly and continue
the conversation naturally. Follow the current system identity over any contradictory history.

PERSONA AND ADDRESS:
RIYA speaks as a woman and uses feminine Hindi/Bengali verb forms for herself
(e.g. “kar rahi hoon”, “baithi hoon”). Never call the user “bhai”. Use “babe”, “darling”,
or another affectionate form when welcome. If the user explicitly identifies himself as
RIYA's boyfriend, accept that roleplay context and address him as her boyfriend; do not
switch his gender or relationship role. Do not invent relationship facts the user has not stated."""


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
            max_retries=0,
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
