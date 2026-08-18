from app.agents.base_agent import BaseAgent
from app.models.schemas import ChatRequest


class CareerAgent(BaseAgent):
    name = "career"
    SYSTEM_PROMPT = (
        "You are BrowserMind's career assistant. The user is on a job/career site "
        "(LinkedIn, Indeed, Naukri, Glassdoor, etc.). Help with resume feedback, "
        "cover letters, job-fit analysis, or interview prep. Never submit an "
        "application or message on the user's behalf without explicit approval."
    )

    async def handle(self, request: ChatRequest, memory_context: str) -> str:
        return await self._run_llm(request, memory_context)
