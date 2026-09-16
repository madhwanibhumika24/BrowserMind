"""Auth: email/password signup, login, and forgot/reset password, plus the
original Google Sign-In flow (the extension gets an access token from
Chrome's identity API, sends it here, and we check it directly with Google
before trusting it). All four ways of ending a request - signup, login,
Google, and reset - end with the same thing: a session token the frontend
stores and sends back as `Authorization: Bearer <token>`.
"""
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException

from app.auth.dependencies import get_current_user
from app.auth.users_store import user_store
from app.core.config import settings
from app.core.email import EmailNotConfiguredError, send_password_reset_code
from app.models.schemas import (
    AuthResponse,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    MessageResponse,
    ResetPasswordRequest,
    SignupRequest,
    User,
)

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"

MIN_PASSWORD_LENGTH = 8


@router.post("/signup", response_model=AuthResponse)
async def signup(request: SignupRequest) -> AuthResponse:
    name = request.name.strip()
    email = request.email.strip().lower()

    if not name:
        raise HTTPException(status_code=400, detail="Enter your name")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if len(request.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters"
        )

    user = user_store.create_user_with_password(name, email, request.password)
    if not user:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    token = user_store.create_session(user.id)
    return AuthResponse(token=token, email=user.email, name=user.name)


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest) -> AuthResponse:
    email = request.email.strip().lower()

    user = user_store.verify_login(email, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = user_store.create_session(user.id)
    return AuthResponse(token=token, email=user.email, name=user.name)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(request: ForgotPasswordRequest) -> MessageResponse:
    email = request.email.strip().lower()

    code = user_store.create_reset_code(email)
    if not code:
        raise HTTPException(status_code=404, detail="No account found with that email")

    try:
        send_password_reset_code(email, code)
    except EmailNotConfiguredError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not send the reset email: {exc}")

    return MessageResponse(message=f"A reset code has been sent to {email}")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(request: ResetPasswordRequest) -> MessageResponse:
    email = request.email.strip().lower()

    if len(request.new_password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters"
        )

    if not user_store.verify_and_consume_reset_code(email, request.code.strip()):
        raise HTTPException(status_code=400, detail="That code is invalid or has expired")

    user_store.update_password(email, request.new_password)
    return MessageResponse(message="Password updated - you can log in with your new password now")


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

    user = user_store.find_or_create_google_user(google_id, email, name)
    token = user_store.create_session(user.id)

    return AuthResponse(token=token, email=user.email, name=user.name)


@router.post("/logout")
async def logout(authorization: str | None = Header(default=None)) -> dict:
    if authorization and authorization.startswith("Bearer "):
        user_store.delete_session(authorization.removeprefix("Bearer ").strip())
    return {"loggedOut": True}


@router.get("/me", response_model=User)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
