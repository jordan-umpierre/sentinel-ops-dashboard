from logging.config import fileConfig
import os
from pathlib import Path
import sys

from alembic import context
from sqlalchemy import engine_from_config, pool


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

sys.path.append(str(Path(__file__).resolve().parents[1]))

# The app settings require a JWT secret, but migrations only need metadata and
# a database URL. This placeholder keeps local Alembic commands ergonomic.
os.environ.setdefault("JWT_SECRET_KEY", "alembic-local-placeholder-not-for-runtime")

from app.core.database import Base  # noqa: E402
from app.domain import models  # noqa: F401,E402


target_metadata = Base.metadata


def get_url() -> str:
    # Mirror the strip/dequote logic in app.core.config so a leading space or
    # stray quote pasted into a hosting provider's env var UI doesn't break
    # alembic. This path runs before the FastAPI Settings layer, so the
    # normalization has to happen locally.
    raw = os.environ.get(
        "DATABASE_URL",
        config.get_main_option("sqlalchemy.url"),
    )
    return (raw or "").strip().strip('"').strip("'")


def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
