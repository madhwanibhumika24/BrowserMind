"""Google Sign-In: the extension gets an access token from Chrome's identity
API, sends it here, and we check it directly with Google before trusting it.
"""
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException

from app.auth.dependencies import get_current_user
from app.auth.users_store import user_store
from app.core.config import settings
from app.models.schemas import AuthResponse, GoogleAuthRequest, User

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


@router.post("/google", response_model=AuthResponse)
async def google_login(request: GoogleAuthRequest) -> AuthResponse:
    async with httpx.AsyncClient() as client:
        # tokeninfo tells us which app this access token was actually issued
        # for (`aud`) - that's what stops someone else's token being replayed
        # against our backend.
        tokeninfo_res = await client.get(
            GOOGLE_TOKENINFO_URL, params={"access_token": request.access_token}
        )
        if tokeninfo_res.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google token")

        tokeninfo = tokeninfo_res.json()
        if settings.google_oauth_client_id and tokeninfo.get("aud") != settings.google_oauth_client_id:
            raise HTTPException(status_code=401, detail="Token was not issued for this app")

        userinfo_res = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {request.access_token}"},
        )
        if userinfo_res.status_code != 200:
            raise HTTPException(status_code=401, detail="Could not fetch Google profile")
        userinfo = userinfo_res.json()

    google_id = userinfo["sub"]
    email = userinfo.get("email", "")
    name = userinfo.get("name", email or "BrowserMind user")

    user_store.find_or_create_user(google_id, email, name)
    token = user_store.create_session(google_id)

    return AuthResponse(token=token, email=email, name=name)


@router.post("/logout")
async def logout(authorization: str | None = Header(default=None)) -> dict:
    if authorization and authorization.startswith("Bearer "):
        user_store.delete_session(authorization.removeprefix("Bearer ").strip())
    return {"loggedOut": True}


@router.get("/me", response_model=User)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
