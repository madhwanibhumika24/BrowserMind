"""BrowserMind backend entrypoint (FastAPI)."""
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    auth,
    chat,
    documents,
    forms,
    memory,
    mindmap,
    ocr,
    pdf_tools,
    quiz,
    summary,
    tabs,
    text_tools,
)
from app.auth.dependencies import get_current_user
from app.core.config import settings
from app.db import models  # noqa: F401 - import so Base knows about these tables
from app.db.session import Base, engine

app = FastAPI(title="BrowserMind API", version="0.1.0")


@app.on_event("startup")
def create_tables() -> None:
    # Small student project, no migrations tool - just make sure the tables
    # exist every time the app starts. Safe to run repeatedly: does nothing
    # if they're already there.
    Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Signing in is the only thing that doesn't require already being signed in.
app.include_router(auth.router)

# Every other feature requires a signed-in user. Adding the dependency here,
# once, covers every route in each router - no need to touch each endpoint.
signed_in = [Depends(get_current_user)]
app.include_router(chat.router, dependencies=signed_in)
app.include_router(memory.router, dependencies=signed_in)
app.include_router(tabs.router, dependencies=signed_in)
app.include_router(quiz.router, dependencies=signed_in)
app.include_router(summary.router, dependencies=signed_in)
app.include_router(documents.router, dependencies=signed_in)

# Forms is intentionally NOT in the signed_in group above - viewing a form
# and submitting a response must work for anyone with the link, with no
# account. /generate and /{id}/results check sign-in themselves (see
# forms.py), since only those two need to know who the user is.
app.include_router(forms.router)

# PDF Tools (merge/split), OCR, Text Tools (grammar/translate), and Mindmap
# are all stateless utilities - nothing is stored and no account is needed
# to use them, so they all stay outside signed_in too.
app.include_router(pdf_tools.router)
app.include_router(ocr.router)
app.include_router(text_tools.router)
app.include_router(mindmap.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
