"""Answers questions about a previously-uploaded document (ChatPDF-style).

Retrieval-based: the document was chunked + embedded into a local Chroma
collection on upload (see documents/store.py), and each question only pulls
in the chunks that are actually relevant to it - instead of stuffing the
whole document into every prompt. This scales to documents far larger than
the old flat MAX_CONTEXT_CHARS cap allowed.

Falls back to the old "just send the stored text" behavior if no chunks
come back for this document (embedding failed on upload, or it was
uploaded before this feature existed).
"""
import asyncio

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.core.llm import get_llm
from app.documents.store import document_store
from app.models.schemas import ChatTurn

# Fallback cap if we have to send raw stored text instead of retrieved chunks.
MAX_CONTEXT_CHARS = 12_000

# How many chunks to retrieve per question.
CHUNKS_PER_QUERY = 6

# Only replay the last few turns - keeps prompts from growing unbounded in
# a long back-and-forth.
MAX_HISTORY_TURNS = 10

# Substrings that show up in Gemini's error messages for things that are
# worth one automatic retry - a temporary blip, not a real problem with the
# request. Matched case-insensitively against str(exception) rather than
# importing google.api_core's specific exception classes, since the exact
# exception type can shift between langchain-google-genai versions.
_TRANSIENT_ERROR_HINTS = (
    "429", "resource_exhausted", "resource has been exhausted", "rate limit",
    "quota", "503", "unavailable", "overloaded", "deadline exceeded", "timeout",
)
_RETRY_DELAY_SECONDS = 2


async def _ask_llm(messages) -> str:
    """Calls the LLM, retrying once after a short delay if the failure looks
    transient (rate limit / temporarily overloaded / timed out). Raises a
    clean, user-facing message on the final failure instead of leaking the
    raw provider exception up to the API response."""
    llm = get_llm()
    last_error: Exception | None = None

    for attempt in range(2):
        try:
            response = await llm.ainvoke(messages)
            return response.content.strip()
        except Exception as exc:
            last_error = exc
            is_transient = any(hint in str(exc).lower() for hint in _TRANSIENT_ERROR_HINTS)
            if attempt == 0 and is_transient:
                await asyncio.sleep(_RETRY_DELAY_SECONDS)
                continue
            if is_transient:
                raise RuntimeError(
                    "The AI provider is rate-limited or temporarily unavailable "
                    "right now - wait a few seconds and try again."
                ) from exc
            raise RuntimeError(f"Could not get a reply from the AI: {exc}") from exc

    raise RuntimeError(f"Could not get a reply from the AI: {last_error}")


def _build_system_prompt(filename: str, context: str) -> str:
    return (
        "You are BrowserMind's document assistant. The user has uploaded the "
        f'following document(s): "{filename}", and is asking you questions '
        "about them. Answer using ONLY the document content below. If it "
        'came from more than one document, each section is marked with a '
        '"=== filename ===" header - say which document an answer came from '
        "when that's relevant, or when documents disagree with each other. "
        "If the answer isn't in the document(s), say so honestly instead of "
        "guessing or making something up.\n\n"
        f"--- DOCUMENT CONTENT ---\n{context}\n"
        "--- END DOCUMENT ---"
    )


async def chat_with_document(
    document_id: str, filename: str, document_text: str, message: str, history: list[ChatTurn]
) -> str:
    chunks = document_store.search_chunks(document_id, message, top_k=CHUNKS_PER_QUERY)
    context = "\n\n---\n\n".join(chunks) if chunks else document_text[:MAX_CONTEXT_CHARS]

    messages = [SystemMessage(content=_build_system_prompt(filename, context))]

    for turn in history[-MAX_HISTORY_TURNS:]:
        if turn.role == "assistant":
            messages.append(AIMessage(content=turn.content))
        else:
            messages.append(HumanMessage(content=turn.content))

    messages.append(HumanMessage(content=message))

    return await _ask_llm(messages)
