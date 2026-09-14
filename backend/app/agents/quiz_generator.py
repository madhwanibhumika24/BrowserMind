import json

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.tab_grouper import detect_category
from app.core.llm import get_llm

SYSTEM_PROMPT = (
    "You are a quiz generator for a browser assistant called BrowserMind. "
    "Given a webpage's title, url and a short excerpt of its content, write "
    "5 multiple-choice quiz questions to test understanding of that page. "
    "Reply with ONLY a JSON array, no extra text, in this exact shape: "
    '[{"question": "...", "options": ["a", "b", "c", "d"], "answer": "..."}]'
)


async def generate_quiz(tab):
    category = detect_category(tab)

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

    # Models sometimes wrap JSON in ```json fences - strip those off.
    if text.startswith("```"):
        text = text.strip("`")
        text = text.replace("json", "", 1).strip()

    items = json.loads(text)
    return category, items
