from fastapi import APIRouter, HTTPException

from app.agents.summarizer import generate_summary
from app.models.schemas import SummaryResponse, TabInfo

router = APIRouter(prefix="/summary", tags=["summary"])


@router.post("/generate", response_model=SummaryResponse)
async def generate(tab: TabInfo) -> SummaryResponse:
    try:
        summary, questions = await generate_summary(tab)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not summarize page: {exc}")

    return SummaryResponse(summary=summary, questions=questions)
