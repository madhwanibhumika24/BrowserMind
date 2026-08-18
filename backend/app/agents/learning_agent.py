from app.agents.base_agent import BaseAgent
from app.models.schemas import ChatRequest


class LearningAgent(BaseAgent):
    name = "learning"

    async def handle(self, request: ChatRequest, memory_context: str) -> str:
        # TODO: wire up LangChain LLM chain with learning-specific system prompt
        return f"[learning-agent placeholder] would answer: {request.message}"
