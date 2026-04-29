from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    """Base class for all ORM models.

    Using a shared SQLAlchemy base keeps metadata registration centralized, which
    matters when FastAPI starts up and creates the Phase 1 schema.
    """


def _engine_kwargs() -> dict:
    """Return engine options that differ between SQLite and PostgreSQL.

    SQLite needs `check_same_thread=False` for FastAPI's threaded request model.
    PostgreSQL does not support that option, so this small helper keeps the
    database URL switch clean and easy to explain.
    """

    if settings.DATABASE_URL.startswith("sqlite"):
        return {"connect_args": {"check_same_thread": False}}
    return {}


engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, **_engine_kwargs())

# Each request gets a short-lived session from this factory. `expire_on_commit`
# is disabled so response serializers can read attributes after commits.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)


def get_db_session():
    """Yield a database session and always close it after the request finishes."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
