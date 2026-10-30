import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from .providers import generate_reply

app = FastAPI(title="RIYA API", version="0.1.0")

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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "riya-api", "stage": "foundation"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest):
    result = await generate_reply(payload.message, payload.history)
    return ChatResponse(reply=result.text, provider=result.provider)
