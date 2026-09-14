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


def _build_system_prompt(filename: str, context: str) -> str:
    return (
        "You are BrowserMind's document assistant. The user has uploaded a "
        f'file called "{filename}" and is asking you questions about it. '
        "Answer using ONLY the document content below. If the answer isn't "
        "in the document, say so honestly instead of guessing or making "
        "something up.\n\n"
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

    llm = get_llm()
    response = await llm.ainvoke(messages)
    return response.content.strip()
