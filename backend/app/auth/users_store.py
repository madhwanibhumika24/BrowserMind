"""Signed-in users, login sessions, and password-reset codes, all backed
by MySQL. Supports two ways to end up with an account - email/password
signup, or Google Sign-In - sharing the same `users` table and the same
session-token mechanism afterwards, so every other route only ever needs
to know "who is `current_user`", not which way they signed in.
"""
import random
import secrets
import uuid
from datetime import datetime, timedelta

import bcrypt

from app.db.models import LoginSessionRow, PasswordResetCodeRow, UserRow
from app.db.session import get_db_session
from app.models.schemas import User

RESET_CODE_TTL_MINUTES = 10


def _to_schema(row: UserRow) -> User:
    return User(
        id=row.id,
        email=row.email,
        name=row.name,
        created_at=row.created_at.isoformat() if row.created_at else "",
    )


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _check_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


class UserStore:
    # ---- email + password ----

    def get_user_by_email(self, email: str) -> User | None:
        db = get_db_session()
        try:
            row = db.query(UserRow).filter(UserRow.email == email).first()
            return _to_schema(row) if row else None
        finally:
            db.close()

    def create_user_with_password(self, name: str, email: str, password: str) -> User | None:
        """Returns None if that email is already registered (by either
        signup method) - the route turns that into a 409 for the user."""
        db = get_db_session()
        try:
            if db.query(UserRow).filter(UserRow.email == email).first():
                return None

            row = UserRow(
                id=str(uuid.uuid4()),
                email=email,
                name=name,
                password_hash=_hash_password(password),
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return _to_schema(row)
        finally:
            db.close()

    def verify_login(self, email: str, password: str) -> User | None:
        """Returns the user if the email/password match, else None -
        covers both "no such account" and "wrong password" (deliberately
        not distinguished by the route, so login errors don't reveal which
        emails are registered)."""
        db = get_db_session()
        try:
            row = db.query(UserRow).filter(UserRow.email == email).first()
            if not row or not row.password_hash:
                return None
            if not _check_password(password, row.password_hash):
                return None
            return _to_schema(row)
        finally:
            db.close()

    def update_password(self, email: str, new_password: str) -> bool:
        db = get_db_session()
        try:
            row = db.query(UserRow).filter(UserRow.email == email).first()
            if not row:
                return False
            row.password_hash = _hash_password(new_password)
            db.commit()
            return True
        finally:
            db.close()

    # ---- Google Sign-In ----

    def find_or_create_google_user(self, google_id: str, email: str, name: str) -> User:
        db = get_db_session()
        try:
            row = db.query(UserRow).filter(UserRow.google_id == google_id).first()
            if row:
                return _to_schema(row)

            # Same email already has a password account? Link this Google
            # ID to it instead of creating a second row - email is unique,
            # so a plain insert here would fail anyway.
            row = db.query(UserRow).filter(UserRow.email == email).first()
            if row:
                row.google_id = google_id
                db.commit()
                db.refresh(row)
                return _to_schema(row)

            row = UserRow(id=str(uuid.uuid4()), google_id=google_id, email=email, name=name)
            db.add(row)
            db.commit()
            db.refresh(row)
            return _to_schema(row)
        finally:
            db.close()

    # ---- sessions ----

    def create_session(self, user_id: str) -> str:
        db = get_db_session()
        try:
            token = secrets.token_urlsafe(32)
            db.add(LoginSessionRow(token=token, user_id=user_id))
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
            user_row = db.get(UserRow, session_row.user_id)
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

    # ---- password reset ----

    def create_reset_code(self, email: str) -> str | None:
        """Returns None if there's no account with that email. Otherwise
        generates a fresh 6-digit code, invalidates any earlier unused
        codes for this email (so only the most recent one works), and
        returns the new code for the route to email out."""
        db = get_db_session()
        try:
            if not db.query(UserRow).filter(UserRow.email == email).first():
                return None

            db.query(PasswordResetCodeRow).filter(
                PasswordResetCodeRow.email == email, PasswordResetCodeRow.used == False  # noqa: E712
            ).update({"used": True})

            code = f"{random.randint(0, 999999):06d}"
            db.add(
                PasswordResetCodeRow(
                    id=str(uuid.uuid4()),
                    email=email,
                    code=code,
                    expires_at=datetime.utcnow() + timedelta(minutes=RESET_CODE_TTL_MINUTES),
                )
            )
            db.commit()
            return code
        finally:
            db.close()

    def verify_and_consume_reset_code(self, email: str, code: str) -> bool:
        """True only for a matching, unused, unexpired code - and marks it
        used either way so a single code can't be replayed."""
        db = get_db_session()
        try:
            row = (
                db.query(PasswordResetCodeRow)
                .filter(
                    PasswordResetCodeRow.email == email,
                    PasswordResetCodeRow.code == code,
                    PasswordResetCodeRow.used == False,  # noqa: E712
                )
                .order_by(PasswordResetCodeRow.created_at.desc())
                .first()
            )
            if not row:
                return False

            row.used = True
            db.commit()

            return datetime.utcnow() <= row.expires_at
        finally:
            db.close()


user_store = UserStore()
