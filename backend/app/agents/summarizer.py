import json

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import get_llm

SYSTEM_PROMPT = (
    "You are BrowserMind, summarizing a webpage for the user. Given a page's "
    "title, url and a short content excerpt, write a short summary (3-4 bullet "
    "points) and 3 good follow-up questions the user might want to ask about "
    "this specific page. Reply with ONLY JSON, no extra text, in this exact "
    'shape: {"summary": "- point one\\n- point two", "questions": ["q1", "q2", "q3"]}'
)


async def generate_summary(tab):
    user_text = f"Title: {tab.title}\nURL: {tab.url}\n"
    if tab.content_excerpt:
        user_text += f"Content: {tab.content_excerpt[:1500]}"
    else:
        user_text += "(No page content was captured, use the title/url as a best guess.)"

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_text),
    ]

    llm = get_llm()
    response = await llm.ainvoke(messages)
    text = response.content.strip()

    if text.startswith("```"):
        text = text.strip("`")
        text = text.replace("json", "", 1).strip()

    data = json.loads(text)
    return data["summary"], data["questions"]
