from app.agents.base_agent import BaseAgent
from app.models.schemas import ChatRequest


class CareerAgent(BaseAgent):
    name = "career"

    async def handle(self, request: ChatRequest, memory_context: str) -> str:
        # TODO: wire up LangChain LLM chain with career-specific system prompt
        return f"[career-agent placeholder] would answer: {request.message}"
