from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings


# Password hashing is isolated here so route handlers never know or care which
# algorithm is used. That keeps security details out of product code and makes
# the implementation easier to audit and maintain.
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plain-text password before storing it."""

    return password_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Compare a login password with the stored password hash."""

    return password_context.verify(password, hashed_password)


def create_access_token(subject: str, extra_claims: Optional[Dict[str, Any]] = None) -> str:
    """Create a short-lived JWT used by the frontend for authenticated requests."""

    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload: Dict[str, Any] = {"sub": subject, "exp": expires_at}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode a JWT and raise `JWTError` if it is invalid or expired."""

    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise
