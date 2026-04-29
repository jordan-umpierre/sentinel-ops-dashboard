from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db_session
from app.core.security import create_access_token
from app.domain.models import User
from app.schemas.auth import LoginRequest, TokenResponse, UserRead
from app.services.auth import authenticate_user


router = APIRouter(tags=["auth"])


def serialize_user(user: User) -> UserRead:
    """Convert an ORM user into the safe public user contract."""

    return UserRead(id=user.id, email=user.email, full_name=user.full_name, role=user.role)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db_session)) -> TokenResponse:
    """Authenticate a demo user and issue the JWT consumed by the frontend."""

    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(subject=user.id, extra_claims={"role": user.role.value})
    return TokenResponse(access_token=token, user=serialize_user(user))


@router.get("/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_user)) -> UserRead:
    """Return the authenticated user so the app shell can restore sessions."""

    return serialize_user(current_user)
