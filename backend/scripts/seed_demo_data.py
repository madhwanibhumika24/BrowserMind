"""Populates BOTH of BrowserMind's databases with realistic demo data:

  - MySQL           -> user info + source-of-truth rows (users,
                        login_sessions, memory_items, documents, forms,
                        form_responses)
  - Chroma (vector)  -> AI-related embeddings for that same content
                        (document_chunks, memory_items collections), so
                        semantic search actually has something to search

Run this once (with the backend's venv active) so there's real data in
both databases - handy for showing your professor the two-database design
(structured data in MySQL, AI/embedding data in the vector store) instead
of empty tables and an empty Chroma folder.

Usage (from the backend/ folder):
    python scripts/seed_demo_data.py

Safe to re-run: it clears out any previous demo rows (MySQL rows tagged
with a "demo-" id, plus their matching Chroma entries) before re-inserting,
so running it twice won't leave duplicates. Documents and memory items go
through the real DocumentStore/RAGMemoryStore classes (not raw inserts) -
the same code path the app itself uses on upload/chat - so this actually
calls the Gemini embeddings API and needs a working GOOGLE_API_KEY in .env.

NOTE: this expects the current `users` schema (id / email / password_hash /
google_id columns). If you seeded data before the email/password auth
change, drop and recreate the `browsermind` database first so
Base.metadata.create_all() below can build the new schema from scratch.
"""
import sys
import uuid
from pathlib import Path

# Let this script be run directly (python scripts/seed_demo_data.py) by
# putting backend/ on the path, same as if it were run as `python -m`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import bcrypt

from app.db import models  # noqa: F401 - registers tables on Base
from app.db.session import Base, SessionLocal, engine
from app.documents.store import document_store
from app.memory.rag_store import memory_store
from app.vectorstore.client import document_chunks_collection, memory_items_collection

DEMO_PREFIX = "demo-"
DEMO_CHAT_SESSION_ID = "demo-chat-session-1"
DEMO_RESUME_FILENAME = "Madhwani_Bhumika_Resume.pdf"
DEMO_PASSWORD = "Demo@1234"  # printed at the end so you can actually log in with it


def demo_id(name: str) -> str:
    return f"{DEMO_PREFIX}{name}"


def clear_previous_demo_data(db) -> None:
    """Deletes anything this script inserted last time - both the MySQL
    rows and their matching Chroma entries - so re-running is idempotent.
    Documents/memory items get real auto-generated ids from the store
    classes (not our "demo-" prefix), so those are matched by session_id /
    creator_id instead.
    """
    db.query(models.FormResponseRow).filter(
        models.FormResponseRow.id.like(f"{DEMO_PREFIX}%")
    ).delete(synchronize_session=False)
    db.query(models.FormRow).filter(models.FormRow.id.like(f"{DEMO_PREFIX}%")).delete(
        synchronize_session=False
    )
    db.query(models.DocumentRow).filter(
        models.DocumentRow.creator_id.like(f"{DEMO_PREFIX}%")
    ).delete(synchronize_session=False)
    db.query(models.MemoryItemRow).filter(
        models.MemoryItemRow.session_id == DEMO_CHAT_SESSION_ID
    ).delete(synchronize_session=False)
    db.query(models.LoginSessionRow).filter(
        models.LoginSessionRow.user_id.like(f"{DEMO_PREFIX}%")
    ).delete(synchronize_session=False)
    db.query(models.UserRow).filter(models.UserRow.id.like(f"{DEMO_PREFIX}%")).delete(
        synchronize_session=False
    )
    db.commit()

    # Matching Chroma cleanup - metadata-based, since these rows don't use
    # our "demo-" id prefix.
    try:
        document_chunks_collection.delete(where={"filename": DEMO_RESUME_FILENAME})
    except Exception:
        pass
    try:
        memory_items_collection.delete(where={"session_id": DEMO_CHAT_SESSION_ID})
    except Exception:
        pass


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        clear_previous_demo_data(db)

        # --- users (MySQL only - no AI content here). Real password hash,
        # so you can actually log in as this account during a demo instead
        # of just looking at a row in a table.
        student = models.UserRow(
            id=demo_id("user-bhumika"),
            email="demo.bhumika@browsermind.local",
            name="Bhumika Madhwani",
            password_hash=_hash_password(DEMO_PASSWORD),
        )
        recruiter = models.UserRow(
            id=demo_id("user-swaroop"),
            email="demo.swaroop@browsermind.local",
            name="Swaroop More",
            password_hash=_hash_password(DEMO_PASSWORD),
        )
        db.add_all([student, recruiter])

        # --- login_sessions (MySQL only) ---
        db.add(
            models.LoginSessionRow(
                token=demo_id("session-" + uuid.uuid4().hex[:12]),
                user_id=student.id,
            )
        )

        # --- forms + form_responses (MySQL only - structured, not embedded) ---
        quiz = models.FormRow(
            id=demo_id("form-dsa-quiz"),
            creator_id=student.id,
            title="DSA Basics Quiz",
            description="A short quiz generated by BrowserMind to test core data structure concepts.",
            kind="quiz",
            questions=[
                {
                    "question": "What is the time complexity of binary search?",
                    "options": ["O(n)", "O(log n)", "O(n^2)", "O(1)"],
                },
                {
                    "question": "Which data structure uses FIFO order?",
                    "options": ["Stack", "Queue", "Tree", "Graph"],
                },
                {
                    "question": "What does a hash map provide on average?",
                    "options": ["O(n) lookup", "O(log n) lookup", "O(1) lookup", "O(n^2) lookup"],
                },
            ],
        )
        db.add(quiz)
        db.add(
            models.FormResponseRow(
                id=demo_id("response-1"),
                form_id=quiz.id,
                answers=["O(log n)", "Queue", "O(1) lookup"],
                score=3,
                total=3,
            )
        )
        db.add(
            models.FormResponseRow(
                id=demo_id("response-2"),
                form_id=quiz.id,
                answers=["O(n)", "Queue", "O(1) lookup"],
                score=2,
                total=3,
            )
        )

        db.commit()
    finally:
        db.close()

    # --- documents: MySQL row + Chroma chunks/embeddings, via the real
    # store class so this seeds the vector DB exactly like a real upload
    # would (chunk_text + Gemini embeddings + upsert into document_chunks).
    document_store.create(
        creator_id=student.id,
        filename=DEMO_RESUME_FILENAME,
        text=(
            "Bhumika Madhwani - B.Tech Computer Engineering. "
            "Skills: Python, FastAPI, LangChain, JavaScript, SQL, Chrome "
            "Extension development, MySQL, vector databases. "
            "Projects: BrowserMind - an AI-powered Chrome extension with "
            "document chat, PDF tools, mind maps, and job-fit analysis "
            "that compares a resume against a job posting's required "
            "skills. Experience: built a multi-agent FastAPI backend using "
            "LangChain and Google Gemini, with MySQL for structured data "
            "and a local Chroma vector store for semantic search over "
            "documents and chat memory."
        ),
    )

    # --- memory_items: MySQL row + Chroma embedding, via the real store
    # class (same one /memory routes and the chat agent use).
    memory_rows = [
        ("user", "I'm preparing for placements and want help with DSA."),
        ("assistant", "Got it - I'll keep that in mind for future answers."),
        ("user", "I'm most interested in backend and AI/ML roles."),
        ("assistant", "Noted: backend and AI/ML are your target roles."),
    ]
    for source, content in memory_rows:
        memory_store.add(session_id=DEMO_CHAT_SESSION_ID, content=content, source=source)

    print("Demo data seeded successfully.")
    print("MySQL tables populated: users, login_sessions, memory_items, documents, forms, form_responses")
    print("Chroma collections populated: document_chunks, memory_items")
    print()
    print("Demo login (email/password auth):")
    print(f"  email:    {student.email}")
    print(f"  password: {DEMO_PASSWORD}")


if __name__ == "__main__":
    seed()
