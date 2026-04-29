from functools import lru_cache
from typing import List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables.

    Defaults favor a quick local run with SQLite, while Docker Compose overrides
    `DATABASE_URL` to use PostgreSQL so the project still demonstrates the
    production-oriented stack named in the brief.
    """

    PROJECT_NAME: str = "Sentinel API"
    API_VERSION: str = "0.1.0"
    DATABASE_URL: str = "sqlite:///./sentinel-dev.db"
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    OPENAI_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("CORS_ORIGINS")
    @classmethod
    def normalize_cors_origins(cls, value: str) -> str:
        """Trim accidental whitespace while preserving simple env-var syntax."""

        return ",".join(origin.strip() for origin in value.split(",") if origin.strip())

    @property
    def cors_origins(self) -> List[str]:
        """Expose CORS origins as the list shape FastAPI expects."""

        return [origin for origin in self.CORS_ORIGINS.split(",") if origin]


@lru_cache
def get_settings() -> Settings:
    """Cache settings so every module reads one consistent configuration object."""

    return Settings()


settings = get_settings()
