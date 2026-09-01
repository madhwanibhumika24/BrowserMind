"""Shared LLM client factory. Agents import get_llm() rather than
constructing their own Gemini client, so model/config stays in one place.
"""
from functools import lru_cache

from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import settings


@lru_cache
def get_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.google_api_key or None,
        temperature=0.4,
    )
