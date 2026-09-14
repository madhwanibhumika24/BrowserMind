"""Signed-in users and their login sessions, backed by MySQL. Same public
methods as the old JSON-file version (find_or_create_user/create_session/
get_user_by_token/delete_session), so auth.py and dependencies.py didn't
need to change.
"""
import secrets

from app.db.models import LoginSessionRow, UserRow
from app.db.session import get_db_session
from app.models.schemas import User


def _to_schema(row: UserRow) -> User:
    return User(
        google_id=row.google_id,
        email=row.email,
        name=row.name,
        created_at=row.created_at.isoformat() if row.created_at else "",
    )


class UserStore:
    def find_or_create_user(self, google_id: str, email: str, name: str) -> User:
        db = get_db_session()
        try:
            row = db.get(UserRow, google_id)
            if row:
                return _to_schema(row)

            row = UserRow(google_id=google_id, email=email, name=name)
            db.add(row)
            db.commit()
            db.refresh(row)
            return _to_schema(row)
        finally:
            db.close()

    def create_session(self, google_id: str) -> str:
        db = get_db_session()
        try:
            token = secrets.token_urlsafe(32)
            db.add(LoginSessionRow(token=token, google_id=google_id))
            db.commit()
            return token
        finally:
            db.close()

    def get_user_by_token(self, token: str) -> User | None:
        db = get_db_session()
        try:
            session_row = db.get(LoginSessionRow, token)
            if not session_row:
                return None
            user_row = db.get(UserRow, session_row.google_id)
            return _to_schema(user_row) if user_row else None
        finally:
            db.close()

    def delete_session(self, token: str) -> None:
        db = get_db_session()
        try:
            row = db.get(LoginSessionRow, token)
            if row:
                db.delete(row)
                db.commit()
        finally:
            db.close()


user_store = UserStore()
