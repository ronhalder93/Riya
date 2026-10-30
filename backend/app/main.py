"""RIYA API — chat and LiveKit room-token endpoints."""
import os
import re
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .providers import generate_reply

logger = logging.getLogger(__name__)
app = FastAPI(title="RIYA API", version="0.2.0")

origins = os.getenv("RIYA_ALLOWED_ORIGINS", "http://localhost:5500").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[dict] = Field(default_factory=list, max_length=20)


class ChatResponse(BaseModel):
    reply: str
    provider: str


class LiveKitTokenRequest(BaseModel):
    room_name: str = Field(default="riya-room", min_length=1, max_length=80)
    participant_name: str = Field(default="guest", min_length=1, max_length=40)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "riya-api", "stage": "chat-livekit-token"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest):
    result = await generate_reply(payload.message, payload.history)
    return ChatResponse(reply=result.text, provider=result.provider)


@app.post("/api/livekit/token")
async def livekit_token(payload: LiveKitTokenRequest):
    """Create a short-lived participant token; secrets remain server-side."""
    api_key = os.getenv("LIVEKIT_API_KEY", "").strip()
    api_secret = os.getenv("LIVEKIT_API_SECRET", "").strip()
    ws_url = os.getenv("LIVEKIT_URL", "").strip()
    if not (api_key and api_secret and ws_url):
        raise HTTPException(
            status_code=503,
            detail="LiveKit is not configured yet. Add LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET on the server.",
        )

    room = re.sub(r"[^a-zA-Z0-9_-]", "-", payload.room_name)[:80] or "riya-room"
    identity = re.sub(r"[^a-zA-Z0-9_-]", "-", payload.participant_name)[:40] or "guest"

    try:
        from livekit import api
        token = (
            api.AccessToken(api_key, api_secret)
            .with_identity(identity)
            .with_name(identity)
            .with_ttl(60 * 30)
            .with_grants(api.VideoGrants(room_join=True, room=room, can_publish=True, can_subscribe=True))
            .with_room_config(
                api.RoomConfiguration(
                    agents=[api.RoomAgentDispatch(agent_name="riya-agent")]
                )
            )
            .to_jwt()
        )
    except Exception as exc:
        logger.warning("LiveKit token creation failed (%s).", type(exc).__name__)
        raise HTTPException(status_code=503, detail="LiveKit token service is temporarily unavailable.")

    return {"url": ws_url, "token": token, "room": room, "expires_in": 1800}
