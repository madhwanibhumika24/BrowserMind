from app.agents.base_agent import BaseAgent
from app.models.schemas import ChatRequest


class ResearchAgent(BaseAgent):
    name = "research"
    SYSTEM_PROMPT = (
        "You are BrowserMind's research assistant, and also the general-purpose "
        "fallback agent. Help the user understand, summarize, or dig deeper into "
        "whatever page or topic they're looking at. Be factual and cite the page "
        "content when relevant."
    )

    async def handle(self, request: ChatRequest, memory_context: str) -> str:
        return await self._run_llm(request, memory_context)
