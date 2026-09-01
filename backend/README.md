# BrowserMind — Backend

FastAPI service that powers the extension: agent routing, RAG memory, and tab summarization.

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env       # then fill in GOOGLE_API_KEY (from https://aistudio.google.com/apikey)
uvicorn app.main:app --reload
```

Server runs at `http://localhost:8000`. Health check: `GET /health`.

## Structure

- `app/agents/` — specialized agents (coding, research, learning, career) + router that picks one based on the active tab
- `app/memory/` — RAG memory store (Chroma-backed vector search)
- `app/api/routes/` — `/chat`, `/memory`, `/tabs` endpoints
- `app/models/schemas.py` — shared Pydantic request/response models
