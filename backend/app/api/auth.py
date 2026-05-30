"""Admin authentication with 2-step login: email+password → OTP verification."""
import time
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from app.core.config import get_settings

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer()
settings = get_settings()


class LoginStep1Request(BaseModel):
    email: str
    password: str


class LoginStep2Request(BaseModel):
    email: str
    otp: str
    session_token: str  # Temporary token from step 1


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: str


class Step1Response(BaseModel):
    session_token: str
    message: str = "OTP required"


def create_token(subject: str = "admin", hours: int = None) -> tuple[str, datetime]:
    h = hours or settings.JWT_EXPIRY_HOURS
    exp = datetime.now(timezone.utc) + timedelta(hours=h)
    payload = {"sub": subject, "exp": exp, "iat": datetime.now(timezone.utc)}
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
    return token, exp


def create_session_token() -> str:
    """Short-lived token (5 min) to carry between step 1 and step 2."""
    exp = datetime.now(timezone.utc) + timedelta(minutes=5)
    payload = {"sub": "otp_session", "exp": exp}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def verify_session_token(token: str) -> bool:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload.get("sub") == "otp_session"
    except jwt.InvalidTokenError:
        return False


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Dependency to protect routes. Returns 'admin' if valid."""
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=["HS256"])
        if payload.get("sub") != "admin":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


# Rate limiting
_failed_attempts: dict[str, list[float]] = {}
MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 300


def _check_rate_limit(key: str):
    now = time.time()
    attempts = _failed_attempts.get(key, [])
    attempts = [t for t in attempts if now - t < LOCKOUT_SECONDS]
    _failed_attempts[key] = attempts
    if len(attempts) >= MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed attempts. Try again in {LOCKOUT_SECONDS // 60} minutes.",
        )


def _record_failure(key: str):
    _failed_attempts.setdefault(key, []).append(time.time())


@router.post("/login/step1", response_model=Step1Response)
async def login_step1(body: LoginStep1Request):
    """Step 1: Verify email + password, return session token for OTP step."""
    _check_rate_limit("login")

    email_match = body.email.strip().lower() == settings.ADMIN_EMAIL.strip().lower()
    password_match = body.password == settings.ADMIN_PASSWORD

    if not (email_match and password_match):
        _record_failure("login")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    session_token = create_session_token()
    return Step1Response(session_token=session_token)


@router.post("/login/step2", response_model=TokenResponse)
async def login_step2(body: LoginStep2Request):
    """Step 2: Verify OTP with valid session token, return full access token."""
    _check_rate_limit("otp")

    # Verify session token from step 1
    if not verify_session_token(body.session_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please login again.")

    # Verify OTP
    otp_match = body.otp.strip() == settings.ADMIN_OTP.strip()
    if not otp_match:
        _record_failure("otp")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OTP")

    # Clear failures on success
    _failed_attempts.pop("login", None)
    _failed_attempts.pop("otp", None)

    token, exp = create_token()
    return TokenResponse(access_token=token, expires_at=exp.isoformat())


@router.get("/me")
async def me(user: str = Depends(verify_token)):
    return {"user": user, "role": "admin"}
