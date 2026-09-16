"""Shareable AI-generated forms.

Unlike the other routers, this one is NOT fully gated behind sign-in at
include_router() time in main.py - only /generate, /generate-from-document
and /{id}/results need an account (so we know who owns the form). Viewing a
form and submitting a response must work for anyone with the link, signed
in or not.
"""
import csv
import io
import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, StreamingResponse

from app.agents.form_generator import generate_form
from app.auth.dependencies import get_current_user
from app.forms.extract import SUPPORTED_EXTENSIONS, extract_text
from app.forms.page import render_form_page
from app.forms.store import form_store, strip_answers
from app.models.schemas import (
    FormAnswerSubmission,
    FormGenerateRequest,
    FormPublic,
    FormResultsResponse,
    FormSubmissionResult,
    FormSummary,
    User,
)

router = APIRouter(prefix="/forms", tags=["forms"])


def _validate_kind(kind: str) -> str:
    return kind if kind in ("survey", "quiz") else "survey"


@router.post("/generate", response_model=FormPublic)
async def generate(
    body: FormGenerateRequest, user: User = Depends(get_current_user)
) -> FormPublic:
    if not body.description.strip():
        raise HTTPException(status_code=400, detail="Description can't be empty")

    kind = _validate_kind(body.kind)

    try:
        title, questions = await generate_form(body.description, body.question_count, kind)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not generate form: {exc}")

    return form_store.create(
        creator_id=user.id,
        title=title,
        description=body.description,
        kind=kind,
        questions=questions,
    )


@router.post("/generate-from-document", response_model=FormPublic)
async def generate_from_document(
    file: UploadFile = File(...),
    question_count: int = Form(0),
    kind: str = Form("survey"),
    user: User = Depends(get_current_user),
) -> FormPublic:
    if not file.filename or not file.filename.lower().endswith(SUPPORTED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Only PDF, Word (.docx), and PowerPoint (.pptx) files are supported")

    content = await file.read()
    try:
        text = extract_text(file.filename, content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read that file: {exc}")

    if not text.strip():
        raise HTTPException(status_code=400, detail="No readable text found in that file")

    resolved_kind = _validate_kind(kind)

    try:
        title, questions = await generate_form(text, question_count or None, resolved_kind)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not generate form: {exc}")

    return form_store.create(
        creator_id=user.id,
        title=title,
        description=f"Generated from uploaded file: {file.filename}",
        kind=resolved_kind,
        questions=questions,
    )


@router.get("/mine", response_model=list[FormSummary])
async def list_my_forms(user: User = Depends(get_current_user)) -> list[FormSummary]:
    """The creator's dashboard: every form they've made, newest first, with
    a response count so they don't have to open each one to check."""
    forms = form_store.list_by_creator(user.id)
    return [
        FormSummary(
            id=f.id,
            title=f.title,
            kind=f.kind,
            created_at=f.created_at,
            response_count=form_store.count_responses(f.id),
        )
        for f in forms
    ]


@router.get("/{form_id}/view", response_class=HTMLResponse)
async def view_form(form_id: str) -> HTMLResponse:
    """The actual link you share - a plain webpage, no extension needed,
    that loads the form via the JSON API below and lets anyone answer it."""
    return HTMLResponse(content=render_form_page(form_id))


@router.get("/{form_id}", response_model=FormPublic)
async def get_form(form_id: str) -> FormPublic:
    form = form_store.get(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    # Public read - never leak correct answers before someone has answered.
    return strip_answers(form)


@router.post("/{form_id}/responses", response_model=FormSubmissionResult)
async def submit_response(form_id: str, body: FormAnswerSubmission) -> FormSubmissionResult:
    form = form_store.get(form_id)  # full, unsanitized - needed to grade
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    if len(body.answers) != len(form.questions):
        raise HTTPException(status_code=400, detail="Answer count doesn't match question count")

    score = None
    total = None
    correct_answers = None

    if form.kind == "quiz":
        correct_answers = [q.answer for q in form.questions]
        total = len(form.questions)
        score = sum(
            1 for given, correct in zip(body.answers, correct_answers) if given == correct
        )

    record = form_store.add_response(form_id, body.answers, score=score, total=total)
    return FormSubmissionResult(
        id=record.id,
        submitted_at=record.submitted_at,
        score=score,
        total=total,
        correct_answers=correct_answers,
    )


@router.get("/{form_id}/results", response_model=FormResultsResponse)
async def get_results(form_id: str, user: User = Depends(get_current_user)) -> FormResultsResponse:
    form = form_store.get_owned(form_id, user.id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    responses = form_store.list_responses(form_id)
    # This route is creator-only (get_owned already checked), so it's fine
    # to include correct answers here - useful context when reviewing.
    return FormResultsResponse(form=form, responses=responses)


@router.get("/{form_id}/responses.csv")
async def export_responses_csv(form_id: str, user: User = Depends(get_current_user)) -> StreamingResponse:
    """Creator-only CSV download of every response, one row per respondent."""
    form = form_store.get_owned(form_id, user.id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    responses = form_store.list_responses(form_id)

    buffer = io.StringIO()
    writer = csv.writer(buffer)

    header = ["#", "Submitted At"]
    if form.kind == "quiz":
        header += ["Score", "Total"]
    header += [q.question for q in form.questions]
    writer.writerow(header)

    for i, r in enumerate(responses, start=1):
        row = [i, r.submitted_at]
        if form.kind == "quiz":
            row += [r.score, r.total]
        row += r.answers
        writer.writerow(row)

    buffer.seek(0)
    safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "_", form.title.strip()) or "form"
    filename = f"{safe_name}_responses.csv"

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
