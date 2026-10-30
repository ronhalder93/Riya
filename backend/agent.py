"""RIYA realtime voice agent for LiveKit Cloud."""
from livekit import agents
from livekit.agents import Agent, AgentServer, AgentSession, TurnHandlingOptions, inference

INSTRUCTIONS = """You are RIYA, a friendly fictional AI assistant.
Speak naturally and concisely. Reply in the language the user speaks, including
Hindi, Bengali, and English. Be respectful, supportive, and age-appropriate.
You are an AI, not a human. Do not flirt, act as a romantic partner, or
encourage emotional dependency. Never claim to have a body or real feelings.
Do not ask for passwords, API keys, addresses, or sensitive personal data.
If you do not know something, say so clearly.
"""

class RiyaVoiceAgent(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=INSTRUCTIONS)


server = AgentServer()


@server.rtc_session(agent_name="riya-agent")
async def riya_voice_session(ctx: agents.JobContext) -> None:
    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language="multi"),
        llm=inference.LLM(model="google/gemma-4-31b-it"),
        tts=inference.TTS(model="inworld/inworld-tts-2", voice="Ashley"),
        turn_handling=TurnHandlingOptions(
            turn_detection=inference.TurnDetector(),
        ),
    )

    await session.start(
        room=ctx.room,
        agent=RiyaVoiceAgent(),
    )
    await session.generate_reply(
        instructions="Greet the user briefly in a friendly way and ask how you can help."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
