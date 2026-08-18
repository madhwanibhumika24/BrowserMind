from app.agents.base_agent import BaseAgent
from app.models.schemas import ChatRequest


class ResearchAgent(BaseAgent):
    name = "research"

    async def handle(self, request: ChatRequest, memory_context: str) -> str:
        # TODO: wire up LangChain LLM chain with research-specific system prompt
        return f"[research-agent placeholder] would answer: {request.message}"
