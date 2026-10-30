"""Provider adapter boundary. Add a real provider server-side when configured."""
from dataclasses import dataclass


@dataclass
class ChatResult:
    text: str
    provider: str = "demo"


async def generate_reply(message: str, history: list[dict]) -> ChatResult:
    """Safe deterministic fallback; no external API or secret is required."""
    clean = message.strip()
    if not clean:
        return ChatResult("Type a message and I'll respond.")
    return ChatResult(
        f"I’m here to chat. You said: “{clean[:400]}”. "
        "The demo backend is working; connect an AI provider to enable generated replies."
    )
