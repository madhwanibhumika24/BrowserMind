"""Shared LLM client factory. Agents import get_llm() rather than
constructing their own ChatOpenAI instance, so model/config stays in one place.
"""
from functools import lru_cache

from langchain_openai import ChatOpenAI

from app.core.config import settings


@lru_cache
def get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key or None,
        temperature=0.4,
    )
