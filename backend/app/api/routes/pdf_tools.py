"""Stateless PDF utilities - merge and split.

No sign-in required and nothing is stored server-side: a file comes in,
a file goes straight back out. Registered outside the signed_in router
group in main.py for that reason (same pattern as the public parts of
forms.py).
"""
import io

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pypdf import PdfReader, PdfWriter

router = APIRouter(prefix="/pdf-tools", tags=["pdf-tools"])

MAX_FILES = 20


def _read_pdf(filename: str | None, content: bytes) -> PdfReader:
    if not filename or not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail=f"'{filename or 'file'}' isn't a PDF")
    try:
        return PdfReader(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read '{filename}': {exc}")


def _pdf_response(writer: PdfWriter, filename: str) -> StreamingResponse:
    buffer = io.BytesIO()
    writer.write(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/merge")
async def merge_pdfs(files: list[UploadFile] = File(...)) -> StreamingResponse:
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Choose at least two PDFs to merge")
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Merge at most {MAX_FILES} files at once")

    writer = PdfWriter()
    for f in files:
        content = await f.read()
        reader = _read_pdf(f.filename, content)
        for page in reader.pages:
            writer.add_page(page)

    return _pdf_response(writer, "merged.pdf")


def _parse_page_ranges(spec: str, page_count: int) -> list[int]:
    """Parses '1-3,5,8-9' (1-indexed, inclusive) into 0-indexed page numbers,
    in the order given, so someone can also use this to reorder pages."""
    indices: list[int] = []
    for chunk in spec.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        if "-" in chunk:
            start_s, _, end_s = chunk.partition("-")
            try:
                start, end = int(start_s), int(end_s)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid page range: '{chunk}'")
            if start < 1 or end < start:
                raise HTTPException(status_code=400, detail=f"Invalid page range: '{chunk}'")
            indices.extend(range(start - 1, end))
        else:
            try:
                page = int(chunk)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid page number: '{chunk}'")
            if page < 1:
                raise HTTPException(status_code=400, detail=f"Invalid page number: '{chunk}'")
            indices.append(page - 1)

    if not indices:
        raise HTTPException(status_code=400, detail="No pages specified")

    out_of_range = [i + 1 for i in indices if i >= page_count]
    if out_of_range:
        raise HTTPException(
            status_code=400,
            detail=f"This PDF only has {page_count} pages - page(s) {out_of_range} don't exist",
        )

    return indices


@router.post("/split")
async def split_pdf(file: UploadFile = File(...), pages: str = Form(...)) -> StreamingResponse:
    content = await file.read()
    reader = _read_pdf(file.filename, content)

    indices = _parse_page_ranges(pages, len(reader.pages))

    writer = PdfWriter()
    for i in indices:
        writer.add_page(reader.pages[i])

    return _pdf_response(writer, "split.pdf")
