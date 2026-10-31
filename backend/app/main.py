"""RIYA API — chat and LiveKit room-token endpoints."""
import logging
import os
import re
from datetime import timedelta

from fastapi import FastAPI, HTTPException
from openai import AsyncOpenAI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .providers import generate_reply

logger = logging.getLogger(__name__)
app = FastAPI(title="RIYA API", version="0.3.0")

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


class AvatarActionRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    reply: str = Field(default="", max_length=5000)
    history: list[dict] = Field(default_factory=list, max_length=20)


class AvatarActionResponse(BaseModel):
    mood: str = "neutral"
    gaze: str = "camera"
    gesture: str = "none"
    body: str = "idle"
    move_x: float | None = None
    move_z: float | None = None


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



@app.post("/api/avatar-action", response_model=AvatarActionResponse)
async def avatar_action(payload: AvatarActionRequest):
    """Interpret conversational intent into safe, supported avatar controls."""
    neutral = AvatarActionResponse()
    if os.getenv("RIYA_AI_PROVIDER", "openrouter").lower() != "openrouter":
        return neutral
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        return neutral

    allowed_moods = {"neutral", "happy", "angry", "sad", "fear", "disgust", "love", "sleep"}
    allowed_gazes = {"camera", "forward"}
    allowed_gestures = {
        "none", "handup", "index", "ok", "thumbup", "thumbdown", "side", "shrug",
        "kiss", "heart",
    }
    allowed_body = {"idle", "walk", "sit"}
    context = []
    for item in payload.history[-8:]:
        if isinstance(item, dict) and item.get("role") in {"user", "assistant"}:
            content = item.get("content", item.get("text", ""))
            if isinstance(content, str) and content.strip():
                context.append({"role": item["role"], "content": content.strip()[:1200]})
    context.extend([
        {"role": "user", "content": payload.message[:2000]},
        {"role": "assistant", "content": payload.reply[:2500]},
    ])
    system = (
        "You control the expressive body language of RIYA, a 3D conversational avatar. "
        "Infer the user's intended interaction from the latest message and short conversation context. "
        "Do not use keyword matching: understand natural Hindi, Hinglish, Bengali, and English. "
        "Only react physically when the user is addressing RIYA or the context clearly asks for a reaction; "
        "if the user is merely discussing an action, choose no gesture. "
        "Return ONLY a JSON object with keys mood, gaze, gesture, body, move_x, move_z. "
        "mood must be one of neutral,happy,angry,sad,fear,disgust,love,sleep. "
        "gaze must be camera or forward. "
        "gesture must be one of none,handup,index,ok,thumbup,thumbdown,side,shrug,kiss,heart. "
        "Use kiss for a requested affectionate kiss gesture, heart for a loving expression, "
        "handup for greeting/waving, shrug for uncertainty, and suitable supported gestures otherwise. "
        "For a direct natural-language request to walk, move, or come closer, set body=walk; "
        "this only animates walking in place and does NOT move the avatar through the room. "
        "For a direct request to sit or take a seat, set body=sit; for stand, get up, or stop moving, "
        "set body=idle. These actions can be requested conversationally in Hindi, Hinglish, Bengali, "
        "or English. Do not trigger them when the user is merely discussing the action. "
        "Approaching the camera/bed, changing room position, and dancing are unsupported; never claim "
        "those happened. For all unrelated messages set body=idle."
    )
    try:
        client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            timeout=18.0,
            max_retries=0,
        )
        response = await client.chat.completions.create(
            model=os.getenv("RIYA_LLM_MODEL", "sao10k/l3.3-euryale-70b"),
            messages=[{"role": "system", "content": system}, *context],
            max_tokens=120,
        )
        import json
        raw = response.choices[0].message.content or "{}"
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            start, end = raw.find("{"), raw.rfind("}")
            if start < 0 or end <= start:
                raise
            data = json.loads(raw[start:end + 1])
        mood = data.get("mood", "neutral")
        gaze = data.get("gaze", "camera")
        gesture = data.get("gesture", "none")
        body = data.get("body", "idle")
        return AvatarActionResponse(
            mood=mood if mood in allowed_moods else "neutral",
            gaze=gaze if gaze in allowed_gazes else "camera",
            gesture=gesture if gesture in allowed_gestures else "none",
            body=body if body in allowed_body else "idle",
            move_x=data.get("move_x") if isinstance(data.get("move_x"), (int, float)) else None,
            move_z=data.get("move_z") if isinstance(data.get("move_z"), (int, float)) else None,
        )
    except Exception as exc:
        logger.info("Avatar action planning unavailable (%s).", type(exc).__name__)
        return neutral

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
            .with_ttl(timedelta(seconds=60 * 30))
            .with_grants(
                api.VideoGrants(room_join=True, room=room, can_publish=True, can_subscribe=True)
            )
            .with_room_config(
                api.RoomConfiguration(agents=[api.RoomAgentDispatch(agent_name="riya-agent")])
            )
            .to_jwt()
        )
    except Exception as exc:
        logger.warning("LiveKit token creation failed (%s).", type(exc).__name__)
        raise HTTPException(status_code=503, detail="LiveKit token service is temporarily unavailable.")

    return {"url": ws_url, "token": token, "room": room, "expires_in": 1800}
