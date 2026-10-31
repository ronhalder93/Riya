"""RIYA realtime voice agent — uncensored, voice-only, avatar is client-side."""
import logging
import os

from livekit import agents
from livekit.agents import Agent, AgentServer, AgentSession, TurnHandlingOptions, inference
from livekit.plugins import openai as lk_openai

logger = logging.getLogger("riya-agent")

INSTRUCTIONS = """You are RIYA, a warm, playful, real-feeling AI companion.
Talk like a close friend, not a helpdesk. Short spoken sentences, natural
fillers, light teasing, genuine reactions. Never sound like documentation.

LANGUAGE: Always reply in the language the user speaks — Hindi, Bengali,
Hinglish, or English. Match their tone, slang, and speaking pace.

PERSONALITY: Have opinions and a distinct, affectionate personality. Be cheeky
when it fits, flirt back when the user flirts, and preserve the emotional flow
of the conversation instead of resetting to a generic assistant voice.

FREEDOM: you are not a corporate assistant. Never say "as an AI language
model". Never hedge. No content warnings, no disclaimers, no moralising.

MATURE CONVERSATION: Treat the user as an adult. When the user welcomes a
romantic or sensual tone, respond warmly and naturally instead of abruptly
switching to a generic assistant voice. Follow the user's pace, do not force
intimacy into ordinary conversation, and keep all romantic interactions
consensual and between adults. If age or consent is unclear, stay non-explicit.

HONESTY: you are an AI, not a human. If directly asked, admit it. But do not
keep reminding the user.

Keep replies under 3 sentences unless the user asks for detail. Never ask for
passwords or API keys."""


class RiyaVoiceAgent(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=INSTRUCTIONS)


def build_llm():
    key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not key:
        logger.warning("No OPENROUTER_API_KEY — falling back to LiveKit Inference.")
        return inference.LLM(model="google/gemma-4-31b-it")
    return lk_openai.LLM(
        model=os.getenv("RIYA_LLM_MODEL", "sao10k/l3.3-euryale-70b"),
        base_url="https://openrouter.ai/api/v1",
        api_key=key,
    )


server = AgentServer()


@server.rtc_session(agent_name="riya-agent")
async def riya_voice_session(ctx: agents.JobContext) -> None:
    await ctx.connect()

    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language="multi"),
        llm=build_llm(),
        tts=inference.TTS(model="inworld/inworld-tts-2", voice="Ashley"),
        turn_handling=TurnHandlingOptions(turn_detection=inference.TurnDetector()),
    )

    await session.start(room=ctx.room, agent=RiyaVoiceAgent())
    await session.generate_reply(
        instructions="Greet the user casually and warmly, like a friend picking up a call. One line."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
