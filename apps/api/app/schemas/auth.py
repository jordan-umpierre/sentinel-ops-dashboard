from pydantic import BaseModel, EmailStr

from app.domain.enums import UserRole


class LoginRequest(BaseModel):
    """JSON login payload sent by the frontend login form."""

    email: EmailStr
    password: str


class UserRead(BaseModel):
    """Safe user shape returned to the browser."""

    id: str
    email: EmailStr
    full_name: str
    role: UserRole


class TokenResponse(BaseModel):
    """Access token response that also includes user context for the shell."""

    access_token: str
    token_type: str = "bearer"
    user: UserRead
