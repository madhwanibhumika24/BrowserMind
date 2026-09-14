from fastapi import APIRouter, HTTPException

from app.agents.quiz_generator import generate_quiz
from app.models.schemas import QuizResponse, TabInfo

router = APIRouter(prefix="/quiz", tags=["quiz"])


@router.post("/generate", response_model=QuizResponse)
async def generate(tab: TabInfo) -> QuizResponse:
    try:
        category, items = await generate_quiz(tab)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not generate quiz: {exc}")

    return QuizResponse(category=category, items=items)
