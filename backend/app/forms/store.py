"""Storage for AI-generated forms and their responses - same store pattern
as memory/rag_store.py (a small class over get_db_session(), converting
rows to Pydantic schemas).
"""
import uuid

from app.db.models import FormResponseRow, FormRow
from app.db.session import get_db_session
from app.models.schemas import FormPublic, FormQuestion, FormResponseRecord


def _form_to_schema(row: FormRow) -> FormPublic:
    return FormPublic(
        id=row.id,
        title=row.title,
        description=row.description,
        kind=row.kind,
        questions=[FormQuestion(**q) for q in row.questions],
        created_at=row.created_at.isoformat() if row.created_at else "",
    )


def strip_answers(form: FormPublic) -> FormPublic:
    """Returns a copy with every question's `answer` cleared - used for the
    public-facing GET so respondents can't peek at correct answers before
    submitting a quiz."""
    sanitized = form.model_copy(deep=True)
    for question in sanitized.questions:
        question.answer = None
    return sanitized


def _response_to_schema(row: FormResponseRow) -> FormResponseRecord:
    return FormResponseRecord(
        id=row.id,
        answers=row.answers,
        score=row.score,
        total=row.total,
        submitted_at=row.submitted_at.isoformat() if row.submitted_at else "",
    )


class FormStore:
    def create(
        self, creator_id: str, title: str, description: str, kind: str, questions: list[dict]
    ) -> FormPublic:
        db = get_db_session()
        try:
            row = FormRow(
                id=str(uuid.uuid4()),
                creator_id=creator_id,
                title=title,
                description=description,
                kind=kind,
                questions=questions,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return _form_to_schema(row)
        finally:
            db.close()

    def get(self, form_id: str) -> FormPublic | None:
        db = get_db_session()
        try:
            row = db.get(FormRow, form_id)
            return _form_to_schema(row) if row else None
        finally:
            db.close()

    def get_owned(self, form_id: str, creator_id: str) -> FormPublic | None:
        """Like get(), but only returns the form if this user created it -
        used to gate the results view to the form's owner."""
        db = get_db_session()
        try:
            row = db.get(FormRow, form_id)
            if not row or row.creator_id != creator_id:
                return None
            return _form_to_schema(row)
        finally:
            db.close()

    def add_response(
        self, form_id: str, answers: list[str], score: int | None = None, total: int | None = None
    ) -> FormResponseRecord:
        db = get_db_session()
        try:
            row = FormResponseRow(
                id=str(uuid.uuid4()),
                form_id=form_id,
                answers=answers,
                score=score,
                total=total,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return _response_to_schema(row)
        finally:
            db.close()

    def list_responses(self, form_id: str) -> list[FormResponseRecord]:
        db = get_db_session()
        try:
            rows = (
                db.query(FormResponseRow)
                .filter(FormResponseRow.form_id == form_id)
                .order_by(FormResponseRow.submitted_at)
                .all()
            )
            return [_response_to_schema(r) for r in rows]
        finally:
            db.close()

    def list_by_creator(self, creator_id: str) -> list[FormPublic]:
        """Newest-first, for the 'My Forms' dashboard."""
        db = get_db_session()
        try:
            rows = (
                db.query(FormRow)
                .filter(FormRow.creator_id == creator_id)
                .order_by(FormRow.created_at.desc())
                .all()
            )
            return [_form_to_schema(r) for r in rows]
        finally:
            db.close()

    def count_responses(self, form_id: str) -> int:
        db = get_db_session()
        try:
            return (
                db.query(FormResponseRow)
                .filter(FormResponseRow.form_id == form_id)
                .count()
            )
        finally:
            db.close()


form_store = FormStore()
