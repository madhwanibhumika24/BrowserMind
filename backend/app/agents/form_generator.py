"""Generates a shareable form (title + multiple-choice questions) from a
short free-text description or extracted document text.

Two kinds:
- "survey": opinion/response questions, no correct answer.
- "quiz": real questions with a correct answer, for testing knowledge.
"""
import json
import re

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_llm

MIN_QUESTIONS = 1
MAX_QUESTIONS = 25
DEFAULT_QUESTIONS = 5

# Catches things like "20 questions", "10 mcqs", "make 15 questions" so the
# count someone types in the description is actually honored, even if they
# don't use the separate question-count field.
COUNT_PATTERN = re.compile(r"(\d+)\s*(?:questions?|mcqs?|q's?)", re.IGNORECASE)


def _resolve_question_count(text: str, requested: int | None) -> int:
    count = requested
    if not count:
        match = COUNT_PATTERN.search(text)
        count = int(match.group(1)) if match else DEFAULT_QUESTIONS
    return max(MIN_QUESTIONS, min(MAX_QUESTIONS, count))


def _build_prompt(count: int, kind: str) -> str:
    if kind == "quiz":
        shape = (
            '{"title": "...", "questions": [{"question": "...", "options": '
            '["a", "b", "c", "d"], "answer": "..."}]}'
        )
        instructions = (
            "Write real quiz questions with plausible options for the given "
            "topic, and include the correct answer for each one (it must "
            'exactly match one of the "options"). Test understanding of the '
            "topic - don't ask for opinions."
        )
    else:
        shape = (
            '{"title": "...", "questions": [{"question": "...", "options": '
            '["a", "b", "c", "d"]}]}'
        )
        instructions = (
            "Write opinion/response questions to collect feedback about the "
            "given topic - there's no correct answer, so do not include an "
            '"answer" field.'
        )

    return (
        "You are a form generator for a browser assistant called "
        f"BrowserMind. Given a short description or document excerpt, write "
        f"a short title and EXACTLY {count} multiple-choice questions. "
        f"{instructions} "
        f"Reply with ONLY a JSON object, no extra text, in this exact shape: "
        f"{shape}. The \"questions\" array must contain exactly {count} items."
    )


async def generate_form(text: str, question_count: int | None = None, kind: str = "survey"):
    count = _resolve_question_count(text, question_count)

    messages = [
        SystemMessage(content=_build_prompt(count, kind)),
        HumanMessage(content=text[:4000]),
    ]

    llm = get_llm()
    response = await llm.ainvoke(messages)
    text_out = response.content.strip()

    # Models sometimes wrap JSON in ```json fences - strip those off.
    if text_out.startswith("```"):
        text_out = text_out.strip("`")
        text_out = text_out.replace("json", "", 1).strip()

    data = json.loads(text_out)
    return data["title"], data["questions"]
