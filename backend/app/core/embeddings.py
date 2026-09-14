"""Shared embeddings client factory, mirroring core/llm.py's pattern.

Uses Google's text-embedding-004 model via the same GOOGLE_API_KEY already
configured for the chat model - no second API key/provider to set up.
"""
from functools import lru_cache

from langchain_google_genai import GoogleGenerativeAIEmbeddings

from app.core.config import settings


@lru_cache
def get_embeddings() -> GoogleGenerativeAIEmbeddings:
    return GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004",
        google_api_key=settings.google_api_key or None,
    )
