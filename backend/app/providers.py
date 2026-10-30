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
    """Use OpenAI Responses API when configured; otherwise use safe demo fallback."""
    clean = message.strip()
    if not clean:
        return ChatResult("Type a message and I'll respond.")

    provider = os.getenv("RIYA_AI_PROVIDER", "demo").lower()
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if provider != "openai" or not api_key:
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
        client = AsyncOpenAI(api_key=api_key, timeout=30.0, max_retries=1)
        response = await client.responses.create(
            model=os.getenv("OPENAI_MODEL", "gpt-6-luna"),
            instructions=SYSTEM_INSTRUCTIONS,
            input=input_items,
            max_output_tokens=350,
            store=False,
        )
        answer = (response.output_text or "").strip()
        if not answer:
            return ChatResult("I couldn't form a reply just now. Please try again.", "openai")
        return ChatResult(answer[:5000], "openai")
    except Exception:
        # Never log request bodies, credentials, or raw provider error details.
        logger.warning("OpenAI request failed; returning a safe temporary error.")
        return ChatResult(
            "RIYA couldn't reach the AI service just now. Please try again in a moment.",
            "openai-error",
        )
