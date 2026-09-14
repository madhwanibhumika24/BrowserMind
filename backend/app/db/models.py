"""SQLAlchemy ORM models - the MySQL equivalent of what used to be
memory.json / users.json / sessions.json.
"""
from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.sql import func

from app.db.session import Base


class UserRow(Base):
    __tablename__ = "users"

    google_id = Column(String(64), primary_key=True)
    email = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class LoginSessionRow(Base):
    """A signed-in session token for a user - NOT the same thing as the
    chat `session_id` in MemoryItemRow below, which just groups messages
    from one conversation.
    """
    __tablename__ = "login_sessions"

    token = Column(String(64), primary_key=True)
    google_id = Column(String(64), ForeignKey("users.google_id"), nullable=False)
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
    creator_id = Column(String(64), ForeignKey("users.google_id"), nullable=False)
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
    creator_id = Column(String(64), ForeignKey("users.google_id"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    text = Column(LONGTEXT, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
