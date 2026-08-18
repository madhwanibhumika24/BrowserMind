"""BrowserMind backend entrypoint (FastAPI)."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import chat, memory, tabs
from app.core.config import settings

app = FastAPI(title="BrowserMind API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(memory.router)
app.include_router(tabs.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
