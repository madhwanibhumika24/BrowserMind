# BrowserMind

An AI-powered Chrome extension that acts as a context-aware browsing assistant — understanding open tabs, routing to specialized agents, remembering past interactions via RAG, and always asking permission before taking action.

See `BrowserMind_AI_Synopsis.md` for the full project synopsis.

## Project structure

```
BrowserMind/
├── backend/          FastAPI service — agent routing, RAG memory, tab summarization
│   └── app/
│       ├── agents/   Specialized agents (coding, research, learning, career) + router
│       ├── memory/   RAG memory store
│       ├── api/      REST endpoints (/chat, /memory, /tabs)
│       └── models/   Shared Pydantic schemas
├── frontend/         Manifest V3 Chrome extension (sidebar UI, background, content script)
└── BrowserMind_AI_Synopsis.md
```

## Getting started

See `backend/README.md` and `frontend/README.md` for setup instructions for each half.
