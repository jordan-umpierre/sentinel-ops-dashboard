FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Dependencies are installed before source is copied so Docker can reuse the
# layer when application code changes but dependency metadata does not.
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY scripts ./scripts
RUN chmod +x ./scripts/entrypoint.sh

EXPOSE 8000

# Honor $PORT for platforms like Fly.io / Render / Railway that assign it
# dynamically; fall back to 8000 for local docker runs.
CMD ["./scripts/entrypoint.sh"]
