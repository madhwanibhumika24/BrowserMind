"""Thin wrapper around a Chroma vector store for the RAG memory system.
Lets users store, retrieve, and delete their own conversation memory.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.core.config import settings
from app.models.schemas import MemoryItem


class RAGMemoryStore:
    def __init__(self) -> None:
        # TODO: initialize a real chromadb.PersistentClient(path=settings.chroma_persist_dir)
        # and an embeddings model. Kept as an in-memory placeholder for now.
        self._items: dict[str, MemoryItem] = {}

    def add(self, session_id: str, content: str, source: str) -> MemoryItem:
        item = MemoryItem(
            id=str(uuid.uuid4()),
            session_id=session_id,
            content=content,
            source=source,  # type: ignore[arg-type]
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self._items[item.id] = item
        return item

    def search(self, session_id: str, query: str, top_k: int = 5) -> list[MemoryItem]:
        # TODO: replace with real vector similarity search
        return [i for i in self._items.values() if i.session_id == session_id][:top_k]

    def list_for_session(self, session_id: str) -> list[MemoryItem]:
        return [i for i in self._items.values() if i.session_id == session_id]

    def delete(self, memory_id: str) -> bool:
        return self._items.pop(memory_id, None) is not None


memory_store = RAGMemoryStore()
