import json
import os
import uuid
from datetime import datetime, timezone

from app.core.config import settings
from app.models.schemas import MemoryItem


class RAGMemoryStore:
    def __init__(self) -> None:
        self.file_path = settings.memory_file
        self._items = self._load()

    def _load(self) -> dict[str, MemoryItem]:
        if not os.path.exists(self.file_path):
            return {}
        with open(self.file_path, "r") as f:
            raw = json.load(f)
        return {item_id: MemoryItem(**data) for item_id, data in raw.items()}

    def _save(self) -> None:
        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
        with open(self.file_path, "w") as f:
            json.dump({k: v.model_dump() for k, v in self._items.items()}, f, indent=2)

    def add(self, session_id: str, content: str, source: str) -> MemoryItem:
        item = MemoryItem(
            id=str(uuid.uuid4()),
            session_id=session_id,
            content=content,
            source=source,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self._items[item.id] = item
        self._save()
        return item

    def search(self, session_id: str, query: str, top_k: int = 5) -> list[MemoryItem]:
        matches = [
            i for i in self._items.values()
            if i.session_id == session_id and query.lower() in i.content.lower()
        ]
        return matches[:top_k]

    def list_for_session(self, session_id: str) -> list[MemoryItem]:
        return [i for i in self._items.values() if i.session_id == session_id]

    def delete(self, memory_id: str) -> bool:
        if memory_id not in self._items:
            return False
        del self._items[memory_id]
        self._save()
        return True


memory_store = RAGMemoryStore()
