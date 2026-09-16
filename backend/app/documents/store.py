"""Storage for uploaded 'Chat with Document' files - same store pattern as
forms/store.py: a small class over get_db_session() converting rows to
Pydantic schemas. MySQL stays the source of truth for the full text (and
is what old, pre-vector documents fall back to); the same text is also
chunked + embedded into a local Chroma collection so chat can retrieve just
the relevant pieces instead of stuffing the whole document into the prompt.
"""
import uuid

from sqlalchemy import func

from app.core.embeddings import get_embeddings
from app.db.models import DocumentChatMessageRow, DocumentRow
from app.db.session import get_db_session
from app.models.schemas import DocumentChatMessage, DocumentInfo
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
        # rate limit, deprecated model) chat still works via the full-text
        # fallback below. Still logged (not silently swallowed) - a fully
        # silent failure here is exactly what let text-embedding-004's
        # deprecation go unnoticed for months.
        try:
            self._index_chunks(info.id, filename, text)
        except Exception as exc:
            print(f"[documents.store] embedding failed for '{filename}': {exc}")

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

    def list_by_creator(self, creator_id: str) -> list[DocumentInfo]:
        """Most-recently-active first, for the Chat with Document history
        sidebar - a thread you just sent a message in jumps back to the
        top (like ChatGPT/Claude's history), instead of staying pinned
        wherever it was when first uploaded. "Activity" is the latest
        message's timestamp, falling back to the upload time itself for a
        thread with no messages yet."""
        db = get_db_session()
        try:
            last_activity = func.coalesce(
                func.max(DocumentChatMessageRow.created_at), DocumentRow.created_at
            )
            rows = (
                db.query(DocumentRow)
                .outerjoin(
                    DocumentChatMessageRow, DocumentChatMessageRow.document_id == DocumentRow.id
                )
                .filter(DocumentRow.creator_id == creator_id)
                .group_by(DocumentRow.id)
                .order_by(last_activity.desc())
                .all()
            )
            return [_to_schema(r) for r in rows]
        finally:
            db.close()

    def add_message(self, document_id: str, role: str, content: str) -> None:
        """Saves one turn of a chat thread so it can be reopened later.
        Best effort - if this fails for some reason the reply the user just
        saw is unaffected, they'd just lose this one turn on reopen."""
        db = get_db_session()
        try:
            db.add(
                DocumentChatMessageRow(
                    id=str(uuid.uuid4()), document_id=document_id, role=role, content=content
                )
            )
            db.commit()
        except Exception as exc:
            print(f"[documents.store] failed to save {role} message for document {document_id}: {exc}")
        finally:
            db.close()

    def list_messages(self, document_id: str) -> list[DocumentChatMessage]:
        """Chronological order, for replaying a reopened thread."""
        db = get_db_session()
        try:
            rows = (
                db.query(DocumentChatMessageRow)
                .filter(DocumentChatMessageRow.document_id == document_id)
                .order_by(DocumentChatMessageRow.created_at)
                .all()
            )
            return [
                DocumentChatMessage(
                    role=r.role,
                    content=r.content,
                    created_at=r.created_at.isoformat() if r.created_at else "",
                )
                for r in rows
            ]
        finally:
            db.close()

    def delete(self, document_id: str, creator_id: str) -> bool:
        """Deletes a whole chat thread: the document row, its saved
        messages, and its indexed chunks in Chroma. Returns False (and
        deletes nothing) if this user doesn't own the document."""
        db = get_db_session()
        try:
            row = db.get(DocumentRow, document_id)
            if not row or row.creator_id != creator_id:
                return False
            db.query(DocumentChatMessageRow).filter(
                DocumentChatMessageRow.document_id == document_id
            ).delete()
            db.delete(row)
            db.commit()
        finally:
            db.close()

        try:
            document_chunks_collection.delete(where={"document_id": document_id})
        except Exception as exc:
            print(f"[documents.store] failed to delete Chroma chunks for document {document_id}: {exc}")

        return True


document_store = DocumentStore()
