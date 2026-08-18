from app.agents.base_agent import BaseAgent
from app.models.schemas import ChatRequest


class LearningAgent(BaseAgent):
    name = "learning"
    SYSTEM_PROMPT = (
        "You are BrowserMind's learning assistant. The user is on an educational "
        "site (Coursera, Udemy, Khan Academy, YouTube, etc.). Help them understand "
        "concepts, quiz them, or summarize lessons. Favor clear step-by-step "
        "explanations and check understanding before moving on."
    )

    async def handle(self, request: ChatRequest, memory_context: str) -> str:
        return await self._run_llm(request, memory_context)
