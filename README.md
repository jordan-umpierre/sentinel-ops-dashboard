# Sentinel — Real-Time Operational Awareness Dashboard

Sentinel is a portfolio-grade full-stack web application that simulates a live
operational environment where users monitor assets, events, alerts, and site
conditions in real time. The product story is a secure logistics hub command
center — operators sign in with seeded demo accounts and work a live incident
queue while a background simulator continuously generates events, updates asset
states, and correlates incidents.

---

## Why This Project Exists

Most portfolio apps are CRUD clones. Sentinel targets the kind of work done in
telemetry, security operations, logistics, and decision-support systems — where
data arrives continuously, multiple entities are correlated, and operators need
clear signal in noisy environments. Every architectural decision is defensible
in an interview.

---

## Architecture

```
apps/
  api/          FastAPI backend
    app/
      api/        Route modules (auth, assets, events, incidents, dashboard, realtime)
      core/       Config, DB engine, JWT security helpers
      domain/     SQLAlchemy models and shared enums
      schemas/    Pydantic request/response contracts
      services/   Auth, seed data, AI summary provider
      simulation/ Background event simulator + WebSocket broadcaster
  web/          React + TypeScript + Vite frontend
    src/
      app/        App shell, routing, protected routes
      components/ Reusable primitives (MetricCard, StatusBadge, ActivitySparkline, LiveEventToast)
      features/   Auth, dashboard, assets, incidents, events, site, realtime
      lib/        Typed API client, date helpers, tone mappings
      styles/     Tailwind entrypoint + global keyframe animations
```

**Key design decisions:**
- One REST endpoint per resource for reads; `PATCH` for state transitions
- WebSocket stream at `/api/realtime/events` carries the live event feed
- AI summary provider is behind an abstract interface — OpenAI or deterministic fallback
- React Query owns all server state; live events trigger broad invalidation
- SQLite in local dev, PostgreSQL in Docker — zero code changes required

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS (dark theme) |
| Backend | FastAPI, Python 3.9+ |
| ORM | SQLAlchemy 2.0 (async-ready) |
| Database | PostgreSQL (Docker) / SQLite (local dev) |
| Realtime | WebSockets (FastAPI native) |
| Auth | JWT via python-jose, bcrypt passwords |
| AI Summaries | OpenAI gpt-4o-mini behind a swappable provider interface |
| Dev environment | Docker Compose |

---

## Features Implemented

### Phase 1 — Foundation
- JWT login with seeded demo accounts (admin / operator / viewer)
- Protected React shell with role-aware navigation
- SQLAlchemy models: User, Site, Asset, Sensor, Event, Incident, IncidentEvent

### Phase 2 — Core Workspaces
- **Dashboard** — KPI cards, asset status breakdown, severity counts, incident feed
- **Assets** — searchable/filterable table with click-to-detail drawer, metadata panel, recent events
- **Incidents** — split-panel triage workspace with timeline, "why this alert fired" explanation, AI summary
- **Events** — paginated searchable audit trail filtered by asset, severity, type, time window
- **Site** — 2D facility layout with type-specific asset icons (personnel/vehicle/sensor/gateway) and alert highlighting

### Phase 3 — Real-Time
- In-process background simulator emits events every 8 seconds
- Asset battery levels and status update with each event
- Incident correlation: high/critical events open or update an active incident
- Authenticated WebSocket at `/api/realtime/events`
- Frontend `LiveEventsProvider` reconnects automatically on drop
- Live connection status badge with animated pulse in app header
- Dashboard merges live events with historical data in real time
- React Query cache invalidation on every live event (list, detail, summary)

### Phase 4 — AI, Lifecycle & Polish
- **Incident lifecycle** — PATCH `/api/incidents/{id}/status` with role enforcement
  - Operators/admins can acknowledge, resolve, or reopen incidents
  - Viewer accounts are read-only (enforced in both backend and UI)
  - Action buttons map the open → acknowledged → resolved state machine
- **AI incident summaries** — OpenAI `gpt-4o-mini` with `json_object` response format
  - Provider interface allows swapping AI backends without touching routes
  - Deterministic fallback when `OPENAI_API_KEY` is not set
- **24-hour activity sparkline** — `GET /api/dashboard/activity` returns hourly event buckets
  - Rendered as a pure SVG histogram (no charting library required)
  - Peak hour highlighted in amber
- **Live event toast** — bottom-right notification with auto-dismiss progress bar and incident callout
- Animated pulse on WebSocket connection status indicator

---

## Run With Docker

```bash
docker compose up --build
```

Open:
- **Web app**: http://localhost:5173
- **API docs**: http://localhost:8000/docs
- **Health**: http://localhost:8000/api/health

---

## Local Development

**Backend:**
```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

The backend defaults to SQLite (`sentinel-dev.db`) when `DATABASE_URL` is not set.

**Frontend:**
```bash
cd apps/web
npm install
npm run dev
```

**Optional — OpenAI summaries:**
```bash
# apps/api/.env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini  # default
```

Without an API key the app uses the deterministic summary provider — the demo
still looks complete.

---

## Demo Accounts

All accounts use password `sentinel123`:

| Email | Role | Capabilities |
|---|---|---|
| `admin@sentinel.dev` | admin | Full access + incident status transitions |
| `operator@sentinel.dev` | operator | Full access + incident status transitions |
| `viewer@sentinel.dev` | viewer | Read-only — cannot acknowledge or resolve incidents |

---

## Demo Script (Interview / Walkthrough)

1. **Log in** as `operator@sentinel.dev`
2. **Dashboard** — point out the live connection badge pulsing green; watch the
   event stream update every 8 seconds; show the 24-hour activity sparkline
3. **Incidents** — select an open incident; show the "Why This Alert Fired"
   evidence timeline; open the AI summary panel; click **Acknowledge** to
   transition the status, then **Mark Resolved** — note the badge updates
   immediately across both the queue and the detail panel
4. **Assets** — filter by `alert` status; click a row to open the detail drawer;
   show the linked recent events and related incidents
5. **Site** — point out the type-specific icons (person/truck/wifi/server) and
   how alert/offline assets are highlighted in red; click a marker to inspect
6. **Events** — filter by `high` severity + `last hour` time window; show
   pagination; point out the asset attribution column
7. **Log out**, log in as `viewer@sentinel.dev` — note the incident action
   buttons are hidden (viewer is read-only)

---

## Project Structure (Key Files)

```
apps/api/app/
  simulation/generator.py       event simulator + incident correlation
  services/incident_summary.py  OpenAI provider + deterministic fallback
  api/routes_incidents.py       incident list, detail, summary, status PATCH
  api/routes_realtime.py        WebSocket connection manager

apps/web/src/
  features/realtime/LiveEventsContext.tsx   WebSocket client + reconnect logic
  features/incidents/IncidentsPage.tsx      split-panel triage + status mutations
  features/dashboard/DashboardPage.tsx      live-merged event feed + sparkline
  components/LiveEventToast.tsx             auto-dismiss toast notification
  components/ActivitySparkline.tsx          pure SVG 24-hour histogram
  lib/api.ts                                typed API client (all endpoints)
```

---

## Environment Variables

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | SQLite | Set to postgres URL in Docker Compose |
| `JWT_SECRET_KEY` | `change-me-in-production` | Change before any real deployment |
| `OPENAI_API_KEY` | unset | Required for AI summaries; fallback is automatic |
| `OPENAI_MODEL` | `gpt-4o-mini` | Any OpenAI chat model |
| `SIMULATOR_ENABLED` | `true` | Set `false` to stop event generation |
| `SIMULATOR_INTERVAL_SECONDS` | `8` | Cadence between simulated events |

---

## Future Improvements

- **Tests** — pytest integration tests for the incident status state machine; Vitest component tests for the status action buttons and live event feed merge
- **Caching** — store generated AI summaries in the database; avoid re-generating on each open incident
- **Export** — CSV download for filtered event history
- **Map** — swap the 2D layout for a Leaflet or MapLibre map view with real GeoJSON zones
- **Multi-site** — extend the data model to support multiple sites per account
- **Alerts** — configurable threshold rules that trigger incidents without requiring the simulator

---

## Resume Bullets

- Built a real-time full-stack operational dashboard using React, FastAPI, PostgreSQL, and WebSockets
- Implemented a background event simulator with in-process incident correlation and authenticated WebSocket broadcast
- Designed an incident lifecycle state machine with role-based access control enforced at both the API and UI layers
- Integrated AI-generated incident summaries behind a provider interface with graceful fallback to deterministic output
- Rendered a 24-hour event activity chart as a pure SVG histogram without external charting dependencies
- Delivered clean TypeScript typing across a React + React Query frontend and Pydantic-validated FastAPI backend
