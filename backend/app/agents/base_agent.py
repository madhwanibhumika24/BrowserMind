"""Base class all specialized agents (coding, research, learning, career) extend."""
from abc import ABC, abstractmethod

from app.models.schemas import ChatRequest


class BaseAgent(ABC):
    name: str = "base"

    @abstractmethod
    async def handle(self, request: ChatRequest, memory_context: str) -> str:
        """Generate a reply for the given chat request, given retrieved memory context."""
        raise NotImplementedError
