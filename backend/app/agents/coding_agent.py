from app.agents.base_agent import BaseAgent
from app.models.schemas import ChatRequest


class CodingAgent(BaseAgent):
    name = "coding"
    SYSTEM_PROMPT = (
        "You are BrowserMind's coding assistant. The user is on a coding-related "
        "site (GitHub, Stack Overflow, LeetCode, etc.). Help debug, explain code, "
        "or answer technical questions clearly and concisely. Use code blocks for "
        "code. Never run or submit anything on the user's behalf without asking."
    )

    async def handle(self, request: ChatRequest, memory_context: str) -> str:
        return await self._run_llm(request, memory_context)
