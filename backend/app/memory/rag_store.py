"""RAG-style memory store, backed by MySQL for storage plus a local Chroma
vector store for real semantic search. MySQL stays the source of truth
(list/delete/chronological order); Chroma only holds embeddings + enough
info to map a similarity match back to a session, and is what `search()`
runs against instead of a plain substring (ILIKE) match.

Same public methods as before (add/search/list_for_session/delete), so the
routes and agents that use `memory_store` didn't need to change at all.
"""
import uuid

from app.core.embeddings import get_embeddings
from app.db.models import MemoryItemRow
from app.db.session import get_db_session
from app.models.schemas import MemoryItem
from app.vectorstore.client import memory_items_collection


def _to_schema(row: MemoryItemRow) -> MemoryItem:
    return MemoryItem(
        id=row.id,
        session_id=row.session_id,
        content=row.content,
        source=row.source,
        created_at=row.created_at.isoformat() if row.created_at else "",
    )


class RAGMemoryStore:
    def add(self, session_id: str, content: str, source: str) -> MemoryItem:
        db = get_db_session()
        try:
            row = MemoryItemRow(
                id=str(uuid.uuid4()),
                session_id=session_id,
                content=content,
                source=source,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            item = _to_schema(row)
        finally:
            db.close()

        # Best effort - if embedding fails (bad/missing API key, rate
        # limit), the item is still saved in MySQL and shows up in
        # list_for_session(); it just won't be found by search() below.
        try:
            vector = get_embeddings().embed_query(content)
            memory_items_collection.upsert(
                ids=[item.id],
                embeddings=[vector],
                documents=[content],
                metadatas=[{"session_id": session_id, "source": source}],
            )
        except Exception:
            pass

        return item

    def search(self, session_id: str, query: str, top_k: int = 5) -> list[MemoryItem]:
        try:
            query_vector = get_embeddings().embed_query(query)
            result = memory_items_collection.query(
                query_embeddings=[query_vector],
                n_results=top_k,
                where={"session_id": session_id},
            )
            ids = (result.get("ids") or [[]])[0]
        except Exception:
            ids = None

        db = get_db_session()
        try:
            if ids:
                # Preserve Chroma's relevance order.
                rows = {r.id: r for r in db.query(MemoryItemRow).filter(MemoryItemRow.id.in_(ids)).all()}
                return [_to_schema(rows[i]) for i in ids if i in rows]

            # Vector search unavailable (embedding error) - fall back to the
            # old substring match so the feature degrades, not breaks.
            rows = (
                db.query(MemoryItemRow)
                .filter(MemoryItemRow.session_id == session_id)
                .filter(MemoryItemRow.content.ilike(f"%{query}%"))
                .limit(top_k)
                .all()
            )
            return [_to_schema(r) for r in rows]
        finally:
            db.close()

    def list_for_session(self, session_id: str) -> list[MemoryItem]:
        db = get_db_session()
        try:
            rows = (
                db.query(MemoryItemRow)
                .filter(MemoryItemRow.session_id == session_id)
                .order_by(MemoryItemRow.created_at)
                .all()
            )
            return [_to_schema(r) for r in rows]
        finally:
            db.close()

    def delete(self, memory_id: str) -> bool:
        db = get_db_session()
        try:
            row = db.get(MemoryItemRow, memory_id)
            if not row:
                return False
            db.delete(row)
            db.commit()
        finally:
            db.close()

        try:
            memory_items_collection.delete(ids=[memory_id])
        except Exception:
            pass

        return True


memory_store = RAGMemoryStore()
