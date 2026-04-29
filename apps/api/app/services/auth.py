from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.domain.models import User


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Return a user when credentials are valid, otherwise return None.

    The route layer only needs to know whether authentication succeeded. Keeping
    password verification here prevents auth details from leaking into endpoints.
    """

    user = db.scalar(select(User).where(User.email == email.lower()))
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user
