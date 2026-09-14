"""Mindmap generator - stateless, one-shot LLM tool, no sign-in required,
same pattern as pdf_tools.py / text_tools.py.
"""
from fastapi import APIRouter, HTTPException

from app.agents.mindmap_generator import generate_mindmap
from app.models.schemas import MindmapRequest, MindmapResponse

router = APIRouter(prefix="/mindmap", tags=["mindmap"])


@router.post("/generate", response_model=MindmapResponse)
async def generate(body: MindmapRequest) -> MindmapResponse:
    if not body.topic.strip():
        raise HTTPException(status_code=400, detail="Topic can't be empty")

    try:
        root = await generate_mindmap(body.topic)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not generate a mindmap: {exc}")

    return MindmapResponse(root=root)
