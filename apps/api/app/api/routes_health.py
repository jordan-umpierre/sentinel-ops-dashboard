from fastapi import APIRouter

from app.core.config import settings


router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    """Lightweight readiness check for Docker, CI, and deployed demos."""

    return {"status": "ok", "service": settings.PROJECT_NAME, "version": settings.API_VERSION}
