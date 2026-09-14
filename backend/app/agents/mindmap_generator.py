"""Turns a topic into a small mindmap - a tree of {title, children} the
frontend renders as nested boxes. One LLM call, no state, same shape as the
other stateless generator agents.
"""
import json

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_llm

# Kept small on purpose - a tree this shallow/narrow is still readable when
# rendered as plain nested HTML boxes (no charting library involved).
MAX_DEPTH = 3
MAX_BRANCHES = 5

SYSTEM_PROMPT = (
    "You are a mindmap generator. Given a topic, break it down into a tree "
    "of key ideas. Reply with ONLY a JSON object, no extra text, in this "
    'exact shape: {"title": "<the topic, tidied up>", "children": ['
    '{"title": "<subtopic>", "children": [{"title": "<detail>", "children": []}, ...]}, ...]}. '
    f"Use at most {MAX_DEPTH} levels of depth (counting the root) and at "
    f"most {MAX_BRANCHES} children per node. Keep each title short (a few "
    "words, not a sentence). Leaf nodes must have an empty children list."
)


def _parse_json_response(text_out: str) -> dict:
    text_out = text_out.strip()
    if text_out.startswith("```"):
        text_out = text_out.strip("`")
        text_out = text_out.replace("json", "", 1).strip()
    return json.loads(text_out)


def _enforce_limits(node: dict, depth: int = 1) -> dict:
    """Belt-and-braces trim in case the model ignores the depth/branch caps
    in the prompt - keeps the response render-friendly either way."""
    title = str(node.get("title", "")).strip() or "Untitled"
    children = node.get("children") or []

    if depth >= MAX_DEPTH:
        return {"title": title, "children": []}

    trimmed = [_enforce_limits(child, depth + 1) for child in children[:MAX_BRANCHES]]
    return {"title": title, "children": trimmed}


async def generate_mindmap(topic: str) -> dict:
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=topic[:500]),
    ]

    llm = get_llm()
    response = await llm.ainvoke(messages)
    data = _parse_json_response(response.content)
    return _enforce_limits(data)
