"""Endpoints for users to view and delete their stored memory."""
from fastapi import APIRouter, HTTPException

from app.memory.rag_store import memory_store
from app.models.schemas import MemoryDeleteRequest, MemoryItem

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("/{session_id}", response_model=list[MemoryItem])
async def list_memory(session_id: str) -> list[MemoryItem]:
    return memory_store.list_for_session(session_id)


@router.delete("")
async def delete_memory(request: MemoryDeleteRequest) -> dict:
    deleted = memory_store.delete(request.memory_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory item not found")
    return {"deleted": True}
