"""Image-to-text OCR. Stateless, no sign-in required - same pattern as
pdf_tools.py. See app/ocr/extract.py for the important note about Tesseract
needing a system-level install, separate from `pip install`.
"""
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.ocr.extract import SUPPORTED_EXTENSIONS, extract_text_from_image

router = APIRouter(prefix="/ocr", tags=["ocr"])


@router.post("/extract")
async def extract(file: UploadFile = File(...)) -> dict:
    if not file.filename or not file.filename.lower().endswith(SUPPORTED_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail="Only image files are supported (PNG, JPG, WEBP, BMP, TIFF)",
        )

    content = await file.read()

    try:
        text = extract_text_from_image(content)
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="OCR isn't set up on this server yet (pytesseract isn't installed)",
        )
    except Exception as exc:
        # Covers pytesseract.TesseractNotFoundError (the binary itself missing)
        # without importing pytesseract at module level just to catch it.
        if type(exc).__name__ == "TesseractNotFoundError":
            raise HTTPException(
                status_code=503,
                detail="OCR isn't set up on this server yet (Tesseract binary not found)",
            )
        raise HTTPException(status_code=400, detail=f"Could not read that image: {exc}")

    if not text.strip():
        raise HTTPException(status_code=422, detail="No text could be detected in that image")

    return {"text": text.strip()}
