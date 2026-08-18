"""Chat endpoint: routes a message to the right agent, using tab + memory context."""
from fastapi import APIRouter

from app.agents.router import pick_agent
from app.memory.rag_store import memory_store
from app.models.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    agent = pick_agent(request)

    relevant_memories = memory_store.search(request.session_id, request.message)
    memory_context = "\n".join(m.content for m in relevant_memories)

    reply = await agent.handle(request, memory_context)

    memory_store.add(request.session_id, request.message, source="user")
    memory_store.add(request.session_id, reply, source="assistant")

    return ChatResponse(reply=reply, agent_used=agent.name)
