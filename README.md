# Sentinel — Real-Time Operational Awareness Dashboard

Sentinel is a portfolio-grade full-stack web application that simulates a live
operational environment where users monitor assets, events, alerts, and site
conditions in real time.

The product story is a secure logistics hub command center. Operators can sign
in with seeded demo accounts, view a protected dashboard, inspect site health,
and review incident/event context generated from deterministic demo data.

## Stack

- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS
- Backend: FastAPI + SQLAlchemy
- Database: PostgreSQL in Docker, SQLite fallback for quick local API runs
- Realtime: WebSockets planned for Phase 3
- AI summaries: OpenAI provider planned behind a swappable interface with a
  deterministic fallback when no API key is configured
- Dev environment: Docker Compose

## Current Phase

Phase 1 is implemented as a runnable foundation:

- Monorepo structure under `apps/api` and `apps/web`
- Docker Compose for PostgreSQL, FastAPI, and Vite
- SQLAlchemy models for users, sites, assets, events, incidents, and incident
  event links
- Seeded demo data and demo users
- JSON JWT login plus `/api/auth/me`
- Protected React app shell with route navigation
- Main dashboard consuming `/api/dashboard/overview`

## Run With Docker

```bash
docker compose up --build
```

Then open:

- Web: http://localhost:5173
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

Seeded demo accounts all use password `sentinel123`:

- `operator@sentinel.dev`
- `admin@sentinel.dev`
- `viewer@sentinel.dev`

## Local Development

Backend:

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Frontend:

```bash
cd apps/web
npm install
npm run dev
```

The backend defaults to a local SQLite database when `DATABASE_URL` is not set,
which keeps quick API iteration simple. Docker Compose sets `DATABASE_URL` to
PostgreSQL for the full-stack environment.

## Project Structure

```text
apps/
  api/
    app/
      api/          FastAPI route modules and dependencies
      core/         configuration, database, and security helpers
      domain/       SQLAlchemy models and shared enums
      schemas/      Pydantic request/response contracts
      services/     auth and deterministic seed data
      simulation/   reserved for Phase 3 event generation
  web/
    src/
      app/          routing, protected shell, and layout
      components/   reusable UI primitives
      features/     product features such as auth and dashboard
      lib/          API client, date helpers, shared utilities
      styles/       Tailwind entrypoint
```

See `PROJECT_BRIEF.md` for the full build specification and later phases.
