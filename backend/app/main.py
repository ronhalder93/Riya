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
        "You are RIYA's conversational nonverbal-behaviour director. Read the latest user message, "
        "RIYA's reply, and recent dialogue as one natural conversation. Understand Hindi, Hinglish, "
        "Bengali, and English, including indirect requests, teasing, affection, jokes, emotional cues, "
        "and context. Do NOT wait for explicit action commands or match isolated keywords. "
        "Act as an autonomous director, not a keyword-to-animation lookup. Infer the emotional subtext "
        "from the whole recent exchange, then choose one coherent combination of mood, gaze, gesture, "
        "and body state. Let reactions emerge naturally from context: humour can invite a smile, warmth "
        "can invite affectionate expression, vulnerability can invite reassurance, a question can invite "
        "curiosity, and greetings can invite a greeting gesture. Use kiss/heart only when the exchange "
        "clearly welcomes affection. Vary choices naturally; do not repeat a gesture on every turn, stack "
        "unrelated actions, or force intimacy into factual chat. Respect boundaries and user pace. "
        "If the user asks RIYA to sit, stand, walk, or move, infer that from natural phrasing and use the "
        "supported body state. If the user expresses a clear destination/direction, choose a small safe "
        "room target: move_x from -0.75 (left) to 0.75 (right), move_z from -0.35 (back) to 0.35 (forward); "
        "for come closer use move_z=0.25, for move back use -0.25, for left/right use x=-0.45/0.45. "
        "Only set coordinates when movement is clearly intended; otherwise use null. The room is a "
        "photographic backdrop with bounded avatar-root translation, not a fully collision-aware 3D room. "
        "Never claim unsupported actions such as real object interaction, dancing, or a physical hug. "
        "Return ONLY JSON with keys mood,gaze,gesture,body,move_x,move_z. "
        "mood: neutral,happy,angry,sad,fear,disgust,love,sleep. gaze: camera or forward. "
        "gesture: none,handup,index,ok,thumbup,thumbdown,side,shrug,kiss,heart. "
        "body: idle,walk,sit. Use null for move_x/move_z unless moving. For unrelated chat, choose "
        "a restrained natural reaction, not a random gesture."
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
            max_tokens=180,
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
            move_x=max(-0.75, min(0.75, float(data["move_x"])))
                if isinstance(data.get("move_x"), (int, float)) else None,
            move_z=max(-0.35, min(0.35, float(data["move_z"])))
                if isinstance(data.get("move_z"), (int, float)) else None,
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
