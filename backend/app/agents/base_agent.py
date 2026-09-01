"""Base class all specialized agents (coding, research, learning, career) extend.
Each subclass just defines a SYSTEM_PROMPT; the shared _run_llm() handles
building the message stack (system + memory context + tab context + user
message) and calling the LLM, with a graceful fallback if the call fails
(e.g. missing API key during local dev).
"""
from abc import ABC, abstractmethod

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_llm
from app.models.schemas import ChatRequest


class BaseAgent(ABC):
    name: str = "base"
    SYSTEM_PROMPT: str = "You are BrowserMind, a helpful browsing assistant."

    @abstractmethod
    async def handle(self, request: ChatRequest, memory_context: str) -> str:
        raise NotImplementedError

    async def _run_llm(self, request: ChatRequest, memory_context: str) -> str:
        tab_context = (
            f"Active tab: \"{request.active_tab.title}\" ({request.active_tab.url})"
        )
        if request.active_tab.content_excerpt:
            tab_context += f"\nPage excerpt: {request.active_tab.content_excerpt[:1000]}"

        system_text = self.SYSTEM_PROMPT
        if memory_context:
            system_text += f"\n\nRelevant memory from past conversations:\n{memory_context}"
        system_text += f"\n\n{tab_context}"

        messages = [
            SystemMessage(content=system_text),
            HumanMessage(content=request.message),
        ]

        try:
            llm = get_llm()
            response = await llm.ainvoke(messages)
            return response.content
        except Exception as exc:  # noqa: BLE001 - surface a friendly fallback, don't 500
            return (
                f"[{self.name}-agent] Couldn't reach the LLM ({exc.__class__.__name__}). "
                "Check that GOOGLE_API_KEY is set in backend/.env."
            )
