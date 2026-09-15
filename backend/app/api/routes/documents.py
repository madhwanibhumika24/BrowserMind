"""Chat with Document - upload a PDF/DOCX and ask questions about it.

Fully gated behind sign-in (see main.py) - unlike Forms, there's no public
link concept here, each document belongs to and is only chattable by the
user who uploaded it.
"""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.agents.document_chat import chat_with_document
from app.auth.dependencies import get_current_user
from app.documents.store import document_store
from app.forms.extract import SUPPORTED_EXTENSIONS, extract_text
from app.models.schemas import DocumentChatRequest, DocumentChatResponse, DocumentInfo, User

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_UPLOAD_FILES = 10


def _combined_filename(names: list[str]) -> str:
    """One display name for a (possibly multi-file) upload - just the name
    for a single file, otherwise a short comma-joined preview so the chat
    header/list don't try to cram a dozen filenames onto one line."""
    if len(names) == 1:
        return names[0]
    shown = ", ".join(names[:3])
    if len(names) > 3:
        shown += f" +{len(names) - 3} more"
    return shown


@router.post("/upload", response_model=DocumentInfo)
async def upload_document(
    files: list[UploadFile] = File(...), user: User = Depends(get_current_user)
) -> DocumentInfo:
    if not files:
        raise HTTPException(status_code=400, detail="Choose at least one file")
    if len(files) > MAX_UPLOAD_FILES:
        raise HTTPException(status_code=400, detail=f"Upload at most {MAX_UPLOAD_FILES} files at once")

    # Each file's text goes in under its own "=== filename ===" marker so
    # the chunks retrieved during chat still carry which document they came
    # from - lets the assistant say "according to X" when it matters, and
    # keeps multiple documents from blurring into one undifferentiated blob.
    sections: list[str] = []
    names: list[str] = []
    for f in files:
        if not f.filename or not f.filename.lower().endswith(SUPPORTED_EXTENSIONS):
            raise HTTPException(
                status_code=400,
                detail=f"'{f.filename or 'file'}' isn't a PDF, Word, or PowerPoint file",
            )
        content = await f.read()
        try:
            text = extract_text(f.filename, content)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Could not read '{f.filename}': {exc}")

        if not text.strip():
            raise HTTPException(status_code=400, detail=f"No readable text found in '{f.filename}'")

        sections.append(f"=== {f.filename} ===\n{text.strip()}")
        names.append(f.filename)

    combined_text = "\n\n".join(sections)
    return document_store.create(
        creator_id=user.google_id, filename=_combined_filename(names), text=combined_text
    )


@router.post("/{document_id}/chat", response_model=DocumentChatResponse)
async def chat(
    document_id: str, body: DocumentChatRequest, user: User = Depends(get_current_user)
) -> DocumentChatResponse:
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message can't be empty")

    document = document_store.get_owned(document_id, user.google_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        reply = await chat_with_document(
            document.id, document.filename, document.text, body.message, body.history
        )
    except Exception as exc:
        # chat_with_document already raises a clean, user-facing message
        # (see _ask_llm) - pass it straight through instead of re-wrapping it.
        raise HTTPException(status_code=502, detail=str(exc))

    return DocumentChatResponse(reply=reply)
