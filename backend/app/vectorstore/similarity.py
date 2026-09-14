"""DEPRECATED - no longer used.

This held a pure-Python cosine-similarity implementation for a brief
MySQL-only vector storage approach, before switching (back) to Chroma for
similarity search (see app.vectorstore.client). Chroma does its own
similarity search internally, so nothing needs this anymore.

Nothing imports this file. Safe to delete
(backend/app/vectorstore/similarity.py).
"""
