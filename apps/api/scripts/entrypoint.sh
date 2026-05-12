#!/usr/bin/env sh
set -e

# Run database migrations before the API starts accepting traffic. Alembic is
# idempotent and safe to run on every boot; the operational-index migration
# applies only once and is a no-op afterwards. Failures stop the boot so a
# broken schema does not get hidden behind a green container.
if [ -n "${DATABASE_URL:-}" ]; then
  echo "Running alembic upgrade head against ${DATABASE_URL%%@*}@***"
  alembic upgrade head
fi

# Honor $PORT for platforms (Fly, Render, Railway) that assign one dynamically.
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
