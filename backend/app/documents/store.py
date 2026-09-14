"""Storage for uploaded 'Chat with Document' files - same store pattern as
forms/store.py: a small class over get_db_session() converting rows to
Pydantic schemas. MySQL stays the source of truth for the full text (and
is what old, pre-vector documents fall back to); the same text is also
chunked + embedded into a local Chroma collection so chat can retrieve just
the relevant pieces instead of stuffing the whole document into the prompt.
"""
import uuid

from app.core.embeddings import get_embeddings
from app.db.models import DocumentRow
from app.db.session import get_db_session
from app.models.schemas import DocumentInfo
from app.vectorstore.chunking import chunk_text
from app.vectorstore.client import document_chunks_collection

# Sanity cap so one huge upload can't blow up storage or every future LLM
# call's cost - generous enough for a multi-page PDF or long lecture notes.
MAX_STORED_CHARS = 50_000


def _to_schema(row: DocumentRow) -> DocumentInfo:
    return DocumentInfo(
        id=row.id,
        filename=row.filename,
        created_at=row.created_at.isoformat() if row.created_at else "",
    )


class DocumentStore:
    def create(self, creator_id: str, filename: str, text: str) -> DocumentInfo:
        db = get_db_session()
        try:
            row = DocumentRow(
                id=str(uuid.uuid4()),
                creator_id=creator_id,
                filename=filename,
                text=text[:MAX_STORED_CHARS],
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            info = _to_schema(row)
        finally:
            db.close()

        # Chunk + embed the (unrestricted, full) text for retrieval. Best
        # effort - if embedding fails for any reason (bad/missing API key,
        # rate limit) chat still works via the full-text fallback below.
        try:
            self._index_chunks(info.id, filename, text)
        except Exception:
            pass

        return info

    def _index_chunks(self, document_id: str, filename: str, text: str) -> None:
        chunks = chunk_text(text)
        if not chunks:
            return

        vectors = get_embeddings().embed_documents(chunks)
        document_chunks_collection.upsert(
            ids=[f"{document_id}::{i}" for i in range(len(chunks))],
            embeddings=vectors,
            documents=chunks,
            metadatas=[
                {"document_id": document_id, "filename": filename, "chunk_index": i}
                for i in range(len(chunks))
            ],
        )

    def search_chunks(self, document_id: str, query: str, top_k: int = 6) -> list[str]:
        """Returns the top_k most relevant chunks of this document for the
        query, in relevance order. Empty list if this document has no
        indexed chunks yet (e.g. embedding failed on upload, or it was
        uploaded before this feature existed) - caller should fall back to
        the full stored text in that case.
        """
        try:
            query_vector = get_embeddings().embed_query(query)
            result = document_chunks_collection.query(
                query_embeddings=[query_vector],
                n_results=top_k,
                where={"document_id": document_id},
            )
        except Exception:
            return []

        docs = result.get("documents") or []
        return docs[0] if docs else []

    def get_owned(self, document_id: str, creator_id: str) -> DocumentRow | None:
        """Returns the raw row (has .text) only if this user uploaded it -
        chat is private per user, unlike forms there's no public link here."""
        db = get_db_session()
        try:
            row = db.get(DocumentRow, document_id)
            if not row or row.creator_id != creator_id:
                return None
            # Detach values we need before the session closes.
            db.expunge(row)
            return row
        finally:
            db.close()


document_store = DocumentStore()
