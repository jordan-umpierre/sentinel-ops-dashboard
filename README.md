# Sentinel — Operational Awareness Console

A full-stack command and control (C2) dashboard for field asset monitoring, correlated incident triage, and AI-assisted operator decision support. Built as a production-representative portfolio project demonstrating real-time data synthesis, role-based access control, and a clean operator UX under the time pressure of live ops.

The architecture mirrors the operator-facing layer of platforms like PRISM and MOSAIC: field assets report telemetry, events are correlated into incidents, and operators get a unified picture of site health across personnel, vehicles, and sensors — without toggling between tools.

---

## Stack

| Layer | Technology |
|---|---|
| API | FastAPI 0.111, SQLAlchemy 2.0, Pydantic v2, JWT auth |
| Database | SQLite (local dev) → PostgreSQL (Docker Compose) |
| Real-time | WebSockets with auto-reconnect, live event simulator |
| AI | OpenAI Chat Completions (`gpt-4o-mini`) with deterministic fallback |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | TanStack Query v5 (React Query) |
| Map | Leaflet + react-leaflet, CartoDB Dark Matter tiles |
| Auth | JWT, bcrypt, role-based access (admin / operator / viewer) |
| Tests | pytest integration suite (71 tests, ~3 s) |

---

## Features by Phase

| Phase | What ships |
|---|---|
| 1 | Auth, asset tracking, event history with pagination + filters, dashboard overview, RBAC |
| 2 | Incident triage workspace with lifecycle state machine, AI summary (OpenAI + fallback), asset detail |
| 3 | Site operating picture with real-time Leaflet map, event activity histogram |
| 4 | WebSocket live event feed, push toast notifications, connection status indicator |
| 5 | Incident status transitions (open → acknowledged → resolved), CSV event export |
| 6 | 71-test pytest integration suite, shimmer skeleton loaders, search debounce |
| 7 | AI summary DB caching with TTL + invalidation on status change, cached/live badge in UI |
| 8 | Live asset map (Leaflet, dark tiles, colored markers, real-time pulse rings) |

---

## Architecture

```
sentinel-ops-dashboard/
├── apps/
│   ├── api/                    # FastAPI backend
│   │   ├── app/
│   │   │   ├── api/            # Route modules (assets, events, incidents, dashboard, realtime)
│   │   │   ├── core/           # Config, database engine, JWT security
│   │   │   ├── domain/         # SQLAlchemy ORM models + enums
│   │   │   ├── schemas/        # Pydantic read/write schemas
│   │   │   ├── services/       # AI summary provider, realtime manager, seed data
│   │   │   └── simulation/     # Background event generator (WebSocket feed)
│   │   └── tests/              # pytest integration tests (71 tests)
│   └── web/                    # React + TypeScript frontend
│       └── src/
│           ├── app/            # Router, protected routes, AppShell
│           ├── components/     # StatusBadge, Skeleton, ActivitySparkline, LiveEventToast
│           ├── features/       # Page components (Dashboard, Assets, Incidents, Site, Events)
│           └── lib/            # API client, tones, date utils, useDebounce
└── docker-compose.yml
```

---

## Running locally (SQLite, no Docker)

```bash
# Backend
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (new terminal)
cd apps/web
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Running with Docker (PostgreSQL)

```bash
docker compose up --build
```

API at `:8000`, frontend at `:5173`.

---

## Demo accounts

| Role | Email | Password | Access |
|---|---|---|---|
| Admin | `admin@sentinel.ops` | `sentinel123` | Full read/write + user management |
| Operator | `operator@sentinel.ops` | `sentinel123` | Incident transitions, event export |
| Viewer | `viewer@sentinel.ops` | `sentinel123` | Read-only, no status mutations |

---

## Interview demo script

The following 8-step walkthrough demonstrates every meaningful system capability in under 5 minutes, framed around a realistic operational scenario: *a perimeter sensor fires an anomaly at 03:00, the system correlates it with a geofence breach, and an operator triages from the console.*

1. **Login as operator** — JWT issued, role-aware nav rendered, WebSocket connects (green "live" indicator)
2. **Dashboard** — metrics card shows active incidents, event activity histogram shows 24-hour signal volume; live event toast fires as the simulator pushes new telemetry
3. **Site → Live Asset Map** — colored markers show all field assets; status rings pulse at the location of the most recent event; click a red/amber marker to inspect it
4. **Assets** — filter by `alert` status; click the flagged asset; inspect the detail panel: zone, battery, recent event timeline, related incidents
5. **Incidents** — select the correlated incident; read the explanation; click "Generate Summary" — AI produces structured triage output (likely cause, affected assets, suggested checks); second load serves from DB cache (badge switches to "cached"); demonstrate refresh
6. **Acknowledge** — operator clicks Acknowledge; status transitions, badge updates, AI cache clears (next summary will reflect new status)
7. **Events → Export CSV** — apply a severity filter, click Export CSV; downloads the filtered audit trail as a file with the correct columns and Content-Disposition header
8. **Login as viewer** — confirm status action buttons are hidden; PATCH /status returns 403

---

## Key files for code review

| File | What to highlight |
|---|---|
| `apps/api/app/services/incident_summary.py` | ABC provider interface, OpenAI Chat Completions, deterministic fallback |
| `apps/api/app/api/routes_incidents.py` | DB-level cache with TTL, cache invalidation on status change, RBAC enforcement |
| `apps/api/app/api/routes_events.py` | Shared filter helper, paginated list + streaming CSV export |
| `apps/api/app/simulation/generator.py` | Background thread pushing WebSocket events |
| `apps/web/src/features/site/SitePage.tsx` | react-leaflet map, live pulse rings from WebSocket feed |
| `apps/web/src/features/incidents/IncidentsPage.tsx` | useMutation, optimistic cache writes, role-aware UI |
| `apps/web/src/lib/api.ts` | Typed API client, exportEvents (fetch → Blob → download) |
| `apps/api/tests/` | 71-test integration suite: lifecycle, RBAC, cache invalidation, CSV |

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./sentinel-dev.db` | Switch to `postgresql://...` for Postgres |
| `JWT_SECRET_KEY` | `change-me-in-production` | Sign and verify access tokens |
| `OPENAI_API_KEY` | *(unset)* | Leave unset to use deterministic fallback |
| `OPENAI_MODEL` | `gpt-4o-mini` | Chat Completions model |
| `SUMMARY_CACHE_TTL_MINUTES` | `60` | How long AI summaries stay cached |
| `SIMULATOR_ENABLED` | `true` | Toggle the background event generator |
| `SIMULATOR_INTERVAL_SECONDS` | `8` | Seconds between generated events |

---

## Design decisions worth discussing

**Why the ABC provider interface for AI?**
The `IncidentSummaryProvider` ABC makes the AI layer swap-safe: a test run uses the deterministic fallback without touching any OpenAI code, and adding a new provider (Anthropic, Azure) is a one-class change. The DB cache layer sits between the route and the provider — same interface regardless of whether we hit the API or the cache.

**Why DB-level caching instead of Redis?**
For a single-region demo app, writing the summary into the same SQLite/Postgres DB as the incident keeps the dependency count at zero. The cache row is invalidated explicitly on status change (not via TTL expiry alone) because status appears in the prompt — a stale "open" label after an acknowledgement would mislead operators.

**Why WebSockets over polling?**
The event simulator pushes new events every 8 seconds. Polling at sub-10 s intervals at scale is expensive; a single persistent WebSocket per client scales much better and eliminates the thundering herd on a shared operations console.

**Why Leaflet instead of a dedicated charting library?**
CartoDB Dark Matter tiles + `divIcon` markers give a production-grade map at zero API cost. The live pulse rings (ephemeral `Circle` elements keyed to incoming WebSocket events) demonstrate that the map isn't decorative — it's wired to the same real-time data pipeline as the toast feed.
