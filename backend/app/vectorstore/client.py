"""Local, embedded vector database (Chroma) - persists to disk under
backend/data/chroma, no separate server process to install or run. This
sits alongside MySQL: MySQL stays the source of truth for the actual rows
(documents, memory_items), Chroma only stores embeddings + enough metadata
to do similarity search and map results back to those rows.

Two collections:
  - document_chunks: chunks of uploaded files, for Chat with Document
  - memory_items: chat memory entries, for RAG memory search
Both use cosine similarity (Google's embedding vectors are meant to be
compared that way).
"""
from pathlib import Path

import chromadb

_PERSIST_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "chroma"
_PERSIST_DIR.mkdir(parents=True, exist_ok=True)

_client = chromadb.PersistentClient(path=str(_PERSIST_DIR))

document_chunks_collection = _client.get_or_create_collection(
    "document_chunks", metadata={"hnsw:space": "cosine"}
)
memory_items_collection = _client.get_or_create_collection(
    "memory_items", metadata={"hnsw:space": "cosine"}
)
