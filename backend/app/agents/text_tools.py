"""Two small one-shot text rewriters - Grammar Checker and Translate.
Both are a single LLM call with no state, same shape as form_generator.py.
"""
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_llm

GRAMMAR_SYSTEM_PROMPT = (
    "You are a grammar and spelling correction tool. Rewrite the user's text "
    "fixing grammar, spelling, and punctuation mistakes, while keeping their "
    "meaning, tone, and formatting (line breaks, lists) exactly as-is. Reply "
    "with ONLY the corrected text - no explanations, no quotes, no preamble. "
    "If the text has no mistakes, reply with it unchanged."
)

TRANSLATE_SYSTEM_PROMPT_TEMPLATE = (
    "You are a translation tool. Translate the user's text into {language}. "
    "Preserve the original meaning, tone, and formatting (line breaks, "
    "lists). Reply with ONLY the translated text - no explanations, no "
    "quotes, no preamble."
)


async def check_grammar(text: str) -> str:
    messages = [
        SystemMessage(content=GRAMMAR_SYSTEM_PROMPT),
        HumanMessage(content=text[:8000]),
    ]
    llm = get_llm()
    response = await llm.ainvoke(messages)
    return response.content.strip()


async def translate_text(text: str, target_language: str) -> str:
    messages = [
        SystemMessage(content=TRANSLATE_SYSTEM_PROMPT_TEMPLATE.format(language=target_language)),
        HumanMessage(content=text[:8000]),
    ]
    llm = get_llm()
    response = await llm.ainvoke(messages)
    return response.content.strip()
