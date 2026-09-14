"""Grammar Checker and Translate - stateless one-shot LLM tools, no
sign-in required, same pattern as pdf_tools.py.
"""
from fastapi import APIRouter, HTTPException

from app.agents.text_tools import check_grammar, translate_text
from app.models.schemas import (
    GrammarCheckRequest,
    GrammarCheckResponse,
    TranslateRequest,
    TranslateResponse,
)

router = APIRouter(prefix="/text-tools", tags=["text-tools"])


@router.post("/grammar", response_model=GrammarCheckResponse)
async def grammar(body: GrammarCheckRequest) -> GrammarCheckResponse:
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Text can't be empty")

    try:
        corrected = await check_grammar(body.text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not check grammar: {exc}")

    return GrammarCheckResponse(corrected=corrected)


@router.post("/translate", response_model=TranslateResponse)
async def translate(body: TranslateRequest) -> TranslateResponse:
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Text can't be empty")
    if not body.target_language.strip():
        raise HTTPException(status_code=400, detail="Choose a target language")

    try:
        translated = await translate_text(body.text, body.target_language)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not translate: {exc}")

    return TranslateResponse(translated=translated)
