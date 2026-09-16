"""SQLAlchemy ORM models - the MySQL equivalent of what used to be
memory.json / users.json / sessions.json.
"""
from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.sql import func

from app.db.session import Base


class UserRow(Base):
    """One account, signed up either with an email + password or with
    Google Sign-In (or, in principle, both - `google_id` just links a
    Google account to this row if the person ever uses it). `id` is a
    provider-agnostic UUID so every other table's `creator_id`/`user_id`
    column doesn't need to care which way someone signed up.
    """
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    email = Column(String(255), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    # Null for accounts that have only ever used Google Sign-In.
    password_hash = Column(String(255), nullable=True)
    # Null for accounts that have only ever used email/password.
    google_id = Column(String(64), nullable=True, unique=True)
    created_at = Column(DateTime, server_default=func.now())


class LoginSessionRow(Base):
    """A signed-in session token for a user - NOT the same thing as the
    chat `session_id` in MemoryItemRow below, which just groups messages
    from one conversation.
    """
    __tablename__ = "login_sessions"

    token = Column(String(64), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class PasswordResetCodeRow(Base):
    """A short-lived 6-digit code emailed to someone who forgot their
    password. Plain-text (not hashed) on purpose - it's single-use, expires
    in minutes, and only ever any good paired with the exact email it was
    sent to, so hashing it adds complexity without a meaningful security
    gain for a project at this scale.
    """
    __tablename__ = "password_reset_codes"

    id = Column(String(36), primary_key=True)
    email = Column(String(255), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())


class MemoryItemRow(Base):
    __tablename__ = "memory_items"

    id = Column(String(36), primary_key=True)
    session_id = Column(String(64), nullable=False, index=True)
    content = Column(Text, nullable=False)
    source = Column(String(16), nullable=False)  # "user" or "assistant"
    created_at = Column(DateTime, server_default=func.now())


class FormRow(Base):
    """An AI-generated form/survey - the shareable link points at this by id.
    `questions` is a JSON list of {"question": str, "options": [str, ...]}.
    """
    __tablename__ = "forms"

    id = Column(String(36), primary_key=True)
    creator_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    kind = Column(String(16), nullable=False, default="survey")  # "survey" or "quiz"
    questions = Column(JSON, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class FormResponseRow(Base):
    """One submission to a form, from anyone with the link - no account
    needed to respond, only to create the form.
    """
    __tablename__ = "form_responses"

    id = Column(String(36), primary_key=True)
    form_id = Column(String(36), ForeignKey("forms.id"), nullable=False, index=True)
    answers = Column(JSON, nullable=False)  # list[str], aligned to questions by index
    score = Column(Integer, nullable=True)  # null for surveys (no right answer)
    total = Column(Integer, nullable=True)
    submitted_at = Column(DateTime, server_default=func.now())


class DocumentRow(Base):
    """An uploaded document for 'Chat with Document' - text is extracted
    once on upload and reused for every chat message, so we never have to
    re-parse the file. LONGTEXT (not TEXT) because MySQL's plain TEXT caps
    out around 64KB, which a multi-page PDF can exceed easily.
    """
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True)
    creator_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    text = Column(LONGTEXT, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class DocumentChatMessageRow(Base):
    """One turn of a 'Chat with Document' conversation - lets a document's
    chat thread be closed and reopened later (the history/memory sidebar),
    instead of only living in the browser tab's memory until it's closed.
    A `DocumentRow` already represents one whole chat thread (it may cover
    several uploaded files at once - see `_combined_filename` in
    api/routes/documents.py), so there's no separate "session" table here:
    `document_id` on its own is the thread key.
    """
    __tablename__ = "document_chat_messages"

    id = Column(String(36), primary_key=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    role = Column(String(16), nullable=False)  # "user" or "assistant"
    content = Column(LONGTEXT, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
