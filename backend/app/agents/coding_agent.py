from app.agents.base_agent import BaseAgent
from app.models.schemas import ChatRequest


class CodingAgent(BaseAgent):
    name = "coding"

    async def handle(self, request: ChatRequest, memory_context: str) -> str:
        # TODO: wire up LangChain LLM chain with coding-specific system prompt
        return f"[coding-agent placeholder] would answer: {request.message}"
