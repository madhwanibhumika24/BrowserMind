"""JobFit - compare a job posting's required skills against a resume.

Stateless like pdf_tools.py: nothing is stored server-side. The resume can
come in as an uploaded file (first use) or as plain text (every use after
that, since the frontend caches the extracted text in the browser's own
local storage) - either way, no sign-in required.
"""
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.agents.jobfit_agent import analyze_job_fit
from app.forms.extract import SUPPORTED_EXTENSIONS, extract_text
from app.models.schemas import JobFitResponse

router = APIRouter(prefix="/jobfit", tags=["jobfit"])


@router.post("/analyze", response_model=JobFitResponse)
async def analyze(
    job_title: str = Form(""),
    job_text: str = Form(...),
    resume: UploadFile | None = File(None),
    resume_text: str = Form(""),
) -> JobFitResponse:
    if not job_text.strip():
        raise HTTPException(status_code=400, detail="No job description text found on this page")

    if resume is not None and resume.filename:
        if not resume.filename.lower().endswith(SUPPORTED_EXTENSIONS):
            raise HTTPException(status_code=400, detail="Resume must be a PDF, Word, or PowerPoint file")
        content = await resume.read()
        try:
            final_resume_text = extract_text(resume.filename, content)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Could not read that resume: {exc}")
    elif resume_text.strip():
        final_resume_text = resume_text
    else:
        raise HTTPException(status_code=400, detail="Upload a resume first")

    if not final_resume_text.strip():
        raise HTTPException(status_code=400, detail="No readable text found in that resume")

    try:
        result = await analyze_job_fit(job_title, job_text, final_resume_text)
    except Exception as exc:
        # analyze_job_fit already raises a clean, user-facing message on
        # LLM failure (see jobfit_agent._invoke_llm) - pass it straight
        # through instead of letting it fall through as a bare 500.
        raise HTTPException(status_code=502, detail=str(exc))

    result.resume_text = final_resume_text
    return result
