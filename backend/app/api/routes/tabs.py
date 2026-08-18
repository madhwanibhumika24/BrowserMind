"""Endpoints for tab-related features: summarizing / organizing open tabs."""
from fastapi import APIRouter

from app.models.schemas import TabInfo

router = APIRouter(prefix="/tabs", tags=["tabs"])


@router.post("/summarize")
async def summarize_tabs(tabs: list[TabInfo]) -> dict:
    # TODO: send tab excerpts to an LLM and cluster/summarize them
    return {"summary": f"Placeholder summary for {len(tabs)} tabs.", "groups": []}
