"""Decides which specialized agent should handle a given tab/message."""
from urllib.parse import urlparse

from app.agents.base_agent import BaseAgent
from app.agents.career_agent import CareerAgent
from app.agents.coding_agent import CodingAgent
from app.agents.learning_agent import LearningAgent
from app.agents.research_agent import ResearchAgent
from app.models.schemas import ChatRequest

_CODING_HOSTS = {"github.com", "stackoverflow.com", "leetcode.com", "gitlab.com"}
_LEARNING_HOSTS = {"coursera.org", "udemy.com", "khanacademy.org", "youtube.com"}
_CAREER_HOSTS = {"linkedin.com", "indeed.com", "naukri.com", "glassdoor.com"}

_AGENTS: dict[str, BaseAgent] = {
    "coding": CodingAgent(),
    "learning": LearningAgent(),
    "career": CareerAgent(),
    "research": ResearchAgent(),
}


def pick_agent(request: ChatRequest) -> BaseAgent:
    """Inspect the active tab's URL to route to the right specialized agent.
    Falls back to the research agent (general-purpose) when no match is found.
    """
    host = urlparse(request.active_tab.url).netloc.replace("www.", "")

    if host in _CODING_HOSTS:
        return _AGENTS["coding"]
    if host in _LEARNING_HOSTS:
        return _AGENTS["learning"]
    if host in _CAREER_HOSTS:
        return _AGENTS["career"]
    return _AGENTS["research"]
