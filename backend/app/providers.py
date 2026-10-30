"""Server-side AI provider adapter for RIYA."""
import logging
import os
from dataclasses import dataclass

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTIONS = """You are RIYA, a fictional, friendly and supportive AI assistant.
Be warm, respectful, concise, and helpful. You are an AI, not a human.
Keep interactions age-appropriate. Do not flirt, act as a romantic partner,
encourage emotional dependency, or claim to have feelings or a body.
If someone seems distressed, respond calmly and encourage them to speak with
a trusted person. Never ask for passwords, API keys, or sensitive personal data.
"""

@dataclass
class ChatResult:
    text: str
    provider: str = "demo"


def _demo_reply(message: str) -> ChatResult:
    clean = message.strip()
    if not clean:
        return ChatResult("Type a message and I'll respond.")
    return ChatResult(
        f"I’m here to chat. You said: “{clean[:400]}”. "
        "Add the server-side OpenAI key to enable AI replies."
    )


async def generate_reply(message: str, history: list[dict]) -> ChatResult:
    """Use Groq Responses API when configured; otherwise use safe demo fallback."""
    clean = message.strip()
    if not clean:
        return ChatResult("Type a message and I'll respond.")

    provider = os.getenv("RIYA_AI_PROVIDER", "groq").lower()
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if provider != "groq" or not api_key:
        return _demo_reply(clean)

    # Only pass a small, validated conversation window to the model.
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
            base_url="https://api.groq.com/openai/v1",
            timeout=30.0,
            max_retries=1,
        )
        response = await client.responses.create(
            model=os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
            instructions=SYSTEM_INSTRUCTIONS,
            input=input_items,
            max_output_tokens=350,
            store=False,
        )
        answer = (response.output_text or "").strip()
        if not answer:
            return ChatResult("I couldn't form a reply just now. Please try again.", "groq")
        return ChatResult(answer[:5000], "openai")
    except Exception as exc:
        # Log only safe diagnostics; never log request bodies, credentials, or raw provider details.
        status_code = getattr(exc, "status_code", None)
        error_body = getattr(exc, "body", None)
        error_info = error_body.get("error", {}) if isinstance(error_body, dict) else {}
        error_code = error_info.get("code") if isinstance(error_info, dict) else None
        error_type = error_info.get("type") if isinstance(error_info, dict) else None
        # Log only short, non-secret diagnostic labels; never log raw messages or request data.
        if not isinstance(error_code, str) or len(error_code) > 80:
            error_code = None
        if not isinstance(error_type, str) or len(error_type) > 80:
            error_type = None
        logger.warning(
            "Groq request failed (exception=%s, status=%s, code=%s, error_type=%s).",
            type(exc).__name__,
            status_code,
            error_code,
            error_type,
        )
        return ChatResult(
            "RIYA couldn't reach the AI service just now. Please try again in a moment.",
            "groq-error",
        )
