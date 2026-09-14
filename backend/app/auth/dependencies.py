"""FastAPI dependency that reads the `Authorization: Bearer <token>` header
and resolves it to a signed-in user, or rejects the request.
"""
from fastapi import Header, HTTPException

from app.auth.users_store import user_store
from app.models.schemas import User


async def get_current_user(authorization: str | None = Header(default=None)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not signed in")

    token = authorization.removeprefix("Bearer ").strip()
    user = user_store.get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired, please sign in again")

    return user
