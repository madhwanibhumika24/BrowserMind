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


@router.post("/upload", response_model=DocumentInfo)
async def upload_document(
    file: UploadFile = File(...), user: User = Depends(get_current_user)
) -> DocumentInfo:
    if not file.filename or not file.filename.lower().endswith(SUPPORTED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Only PDF, Word (.docx), and PowerPoint (.pptx) files are supported")

    content = await file.read()
    try:
        text = extract_text(file.filename, content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read that file: {exc}")

    if not text.strip():
        raise HTTPException(status_code=400, detail="No readable text found in that file")

    return document_store.create(creator_id=user.google_id, filename=file.filename, text=text)


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
        raise HTTPException(status_code=502, detail=f"Could not get a reply: {exc}")

    return DocumentChatResponse(reply=reply)
