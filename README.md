# Sentinel — Operational Awareness Console

A full-stack command-and-control (C2) dashboard for field asset monitoring, correlated incident triage, and AI-assisted operator decision support.

The architecture mirrors the operator-facing layer of platforms like PRISM and MOSAIC: field assets report telemetry, events are correlated into incidents, and operators get a unified picture of site health across personnel, vehicles, and sensors — without toggling between tools.

---

## Stack

| Layer | Technology |
|---|---|
| API | FastAPI 0.111, SQLAlchemy 2.0, Pydantic v2 |
| Database | SQLite (local dev) → PostgreSQL (Docker Compose) |
| Auth | JWT (HS256), bcrypt, role-based access (admin / operator / viewer) |
| Real-time | WebSockets with first-frame auth handshake, auto-reconnect, live event simulator |
| AI | OpenAI Chat Completions (`gpt-4o-mini`) with deterministic fallback provider |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | TanStack Query v5 (React Query) with invalidation on WebSocket push |
| Map | Leaflet + react-leaflet, CartoDB Dark Matter tiles |
| Tests | pytest integration suite (75 tests, ~5 s, isolated SQLite test DB) |

---

## Features

| Release | What ships |
|---|---|
| 1 | JWT auth with RBAC, asset tracking, event history with pagination + filters, dashboard overview |
| 2 | Incident triage workspace, AI summary (OpenAI Chat Completions + deterministic fallback), asset detail panel |
| 3 | Site operating picture, event activity 24-hour histogram |
| 4 | WebSocket live event feed, push toast notifications with incident correlation callout, connection status indicator |
| 5 | 24-hour activity sparkline, incident status transitions (open → acknowledged → resolved) with state machine enforcement, CSV event export |
| 6 | 75-test pytest integration suite, shimmer skeleton loaders, 300 ms search debounce |
| 7 | AI summary DB caching with TTL + explicit invalidation on status change, cached/live badge in UI |
| 8 | Live asset map (Leaflet, dark tiles, status-colored markers, real-time 6 s pulse rings) |

---

## Architecture

```
sentinel-ops-dashboard/
├── apps/
│   ├── api/                         # FastAPI backend
│   │   ├── app/
│   │   │   ├── api/                 # Route modules
│   │   │   │   ├── routes_auth.py
│   │   │   │   ├── routes_assets.py
│   │   │   │   ├── routes_events.py
│   │   │   │   ├── routes_incidents.py
│   │   │   │   ├── routes_dashboard.py
│   │   │   │   └── routes_realtime.py   # WebSocket stream
│   │   │   ├── core/
│   │   │   │   ├── config.py        # pydantic-settings; JWT_SECRET_KEY is required
│   │   │   │   ├── database.py      # SQLAlchemy engine, session factory
│   │   │   │   └── security.py      # JWT encode/decode, bcrypt
│   │   │   ├── domain/
│   │   │   │   ├── models.py        # SQLAlchemy ORM models
│   │   │   │   └── enums.py         # Severity, AssetStatus, IncidentStatus, etc.
│   │   │   ├── schemas/             # Pydantic read/write schemas
│   │   │   ├── services/
│   │   │   │   ├── incident_summary.py  # ABC provider + OpenAI + fallback + DB cache
│   │   │   │   ├── realtime.py          # EventConnectionManager (WebSocket fan-out)
│   │   │   │   └── seed.py              # Demo data + three role accounts
│   │   │   └── simulation/
│   │   │       └── generator.py     # Async simulator: generates events every N s
│   │   ├── alembic/                 # Migration scaffold + operational index migration
│   │   └── tests/                   # pytest integration suite (75 tests)
│   └── web/                         # React + TypeScript frontend
│       └── src/
│           ├── app/                 # Router, ProtectedRoute, AppShell
│           ├── components/          # StatusBadge, Skeleton, ActivitySparkline, LiveEventToast
│           ├── features/
│           │   ├── auth/            # AuthContext, LoginPage, useAuth
│           │   ├── dashboard/       # DashboardPage
│           │   ├── assets/          # AssetsPage
│           │   ├── incidents/       # IncidentsPage (AI summary, lifecycle actions)
│           │   ├── events/          # EventsPage (filters, pagination, CSV export)
│           │   ├── site/            # SitePage (Leaflet map, live pulse rings)
│           │   └── realtime/        # LiveEventsContext, WebSocket provider
│           └── lib/
│               ├── api.ts           # Typed API client (all endpoints)
│               ├── tones.ts         # Severity → color/label mapping
│               └── useDebounce.ts   # 300 ms debounce hook
└── docker-compose.yml
```

---

## Quick start (local, SQLite, no Docker)

**Prerequisites:** Python 3.12+, Node 20+

```bash
# 1. Generate a JWT secret
export JWT_SECRET_KEY=$(openssl rand -hex 32)

# 2. Backend
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
# → API at http://localhost:8000
# → Swagger UI at http://localhost:8000/docs

# 3. Frontend (new terminal)
cd apps/web
npm install
npm run dev
# → UI at http://localhost:5173
```

The backend seeds the database on first startup — demo accounts, a site, 5 assets, 5 events, and one correlated incident are created automatically. The simulator then continues adding live events and correlated incidents while the API is running.

---

## Docker (PostgreSQL)

```bash
# Copy and fill in required variables
cp .env.example .env
# Edit .env:
#   JWT_SECRET_KEY=<output of: openssl rand -hex 32>
#   OPENAI_API_KEY=<your key, or leave empty to use the deterministic fallback>

docker compose up --build
```

- API: `http://localhost:8000`
- Frontend: `http://localhost:5173`
- PostgreSQL: `localhost:5432`

---

## Demo accounts

| Role | Email | Password | Access |
|---|---|---|---|
| Admin | `admin@sentinel.dev` | `sentinel123` | Full read/write |
| Operator | `operator@sentinel.dev` | `sentinel123` | Incident transitions, event export |
| Viewer | `viewer@sentinel.dev` | `sentinel123` | Read-only, no status mutations |

---

## Walkthrough

The following 8-step walkthrough covers every system capability in under 5 minutes, framed around a realistic operational scenario: *a perimeter sensor fires at 03:00, the system correlates it with a geofence breach, and an operator triages from the console.*

1. **Login as operator** (`operator@sentinel.dev` / `sentinel123`)
   JWT issued, role-aware nav rendered, WebSocket connects — green "LIVE" indicator appears in the header.

2. **Dashboard**
   Metric cards show active incidents, assets in alert, and system health (all computed live from DB).
   The 24-hour activity histogram shows event volume by hour; the event feed updates every 8 s from the simulator.

3. **Site → Live Asset Map**
   Leaflet map with CartoDB Dark Matter tiles. Markers are colored by asset status (green/amber/red/grey).
   Pulse rings appear at event coordinates for 6 s when the simulator fires — demonstrating the map is wired to the same WebSocket feed as the toast notifications.

4. **Assets**
   Filter by `alert` status. Click the flagged asset: inspect the detail panel — zone, battery level, recent event timeline, related incidents.

5. **Incidents**
   Select a correlated incident. Click **Generate Summary** — the AI produces structured triage output: likely cause, affected assets, suggested next checks.
   A second click returns instantly with a **"cached"** badge (served from DB, no OpenAI call).
   Click **Refresh** to force regeneration and watch the badge flip to **"live"**.

6. **Acknowledge**
   Click **Acknowledge**. Status transitions from `open → acknowledged`. The AI cache clears automatically because the status is part of the prompt — the next summary will reflect the updated state.

7. **Events → Export CSV**
   Apply a `critical` severity filter. Click **Export CSV** — downloads a properly-headed CSV of the filtered audit trail with `Content-Disposition: attachment`.

8. **Login as viewer** (`viewer@sentinel.dev` / `sentinel123`)
   Confirm status action buttons are hidden. A direct `PATCH /api/incidents/{id}/status` returns `403 Forbidden`.

---

## Key files for code review

| File | What to highlight |
|---|---|
| `apps/api/app/services/incident_summary.py` | ABC provider interface; OpenAI Chat Completions; deterministic fallback; DB cache with TTL and explicit invalidation |
| `apps/api/app/api/routes_incidents.py` | State machine enforcement (invalid transitions → 422); RBAC (viewer → 403); cache invalidation on status change |
| `apps/api/app/api/routes_events.py` | Shared filter helper; paginated list; streaming CSV export via `StreamingResponse` |
| `apps/api/app/api/routes_realtime.py` | WebSocket first-frame auth handshake; 5 s timeout; 1008 close on rejection |
| `apps/api/app/simulation/generator.py` | Background daemon thread; correlated incident generation; WebSocket fan-out |
| `apps/web/src/features/realtime/LiveEventsContext.tsx` | WebSocket provider; first-frame JWT send; auto-reconnect with backoff; React Query invalidation on push |
| `apps/web/src/features/site/SitePage.tsx` | react-leaflet map; live pulse rings keyed to WebSocket events; FitToBounds on first render |
| `apps/web/src/features/incidents/IncidentsPage.tsx` | `useMutation` for status transitions; role-aware button rendering; summary cache invalidation |
| `apps/web/src/lib/api.ts` | Fully typed API client; `exportEvents` (fetch → Blob → `createObjectURL` → download) |
| `apps/api/tests/` | 75-test integration suite covering lifecycle, RBAC, cache invalidation, CSV export, pagination, WebSocket auth |

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET_KEY` | **Yes** | — | Sign/verify access tokens. Generate with: `openssl rand -hex 32`. The server refuses to start without this. |
| `DATABASE_URL` | No | `sqlite:///./sentinel-dev.db` | Switch to `postgresql+psycopg://...` for Postgres |
| `OPENAI_API_KEY` | No | *(unset)* | Leave unset to use the deterministic fallback provider |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Chat Completions model |
| `SUMMARY_CACHE_TTL_MINUTES` | No | `60` | How long AI summaries stay cached before expiry |
| `CORS_ORIGINS` | No | `http://localhost:5173,...` | Comma-separated allowed origins |
| `LOG_LEVEL` | No | `INFO` | API log verbosity for request, realtime, and AI fallback logs |
| `SIMULATOR_ENABLED` | No | `true` | Toggle the background event generator |
| `SIMULATOR_INTERVAL_SECONDS` | No | `8` | Seconds between generated events |

---

## Running the test suite

```bash
cd apps/api
pytest -v
```

75 tests, ~5 seconds. The local suite uses an isolated file-based SQLite database — no running server or Postgres instance required. CI also runs the backend suite against PostgreSQL. Coverage includes:

- Auth: login happy path, wrong password, unknown email, all three roles, `/me` with valid/missing/expired token
- Assets: list filters, type filter, call sign search, battery sort, detail with event history, 404
- Events: pagination shape, severity/type/time-window filters, sort direction, page_size cap, offset
- Incidents: list filters, detail, 404, full `open→acknowledged→resolved→open` state machine, viewer 403, invalid status 422, summary provider
- Dashboard: overview shape, metric non-negativity, activity 24-bucket structure, `total == sum(counts)`
- Summary cache: first call = live, second call = cached, `?refresh=true` bypass, status-change invalidation
- CSV export: content-type, `Content-Disposition` header, column names, filter passthrough
- Realtime: WebSocket first-frame auth accepts valid JWTs and rejects invalid/malformed frames with `1008`

---

## Migrations

The app still calls `Base.metadata.create_all()` on startup. Alembic is included for schema evolution beyond the demo baseline, and the first migration captures the operational indexes used by asset, event, incident, and summary-cache queries.

```bash
cd apps/api
alembic upgrade head
```

---

## Design decisions

**Why the ABC provider interface for AI?**
`IncidentSummaryProvider` is an abstract base class with a single `generate(context)` method. `OpenAIIncidentSummaryProvider` calls Chat Completions with a structured JSON response schema; `FallbackIncidentSummaryProvider` returns a deterministic template without any network call. The DB cache layer wraps both through the same interface. This means: zero API calls during tests, safe demo without an OpenAI key, and adding a new provider (Anthropic, Azure OpenAI) is a one-class change.

**Why DB-level caching instead of Redis?**
For a single-region operational demo, writing the summary into the same SQLite/Postgres instance as the incident data keeps the dependency count at zero and avoids cross-service consistency edge cases. The cache row is invalidated explicitly on status change — not solely via TTL — because the incident status appears in the prompt. Serving a stale "open" summary after an acknowledgement would mislead operators.

**WebSocket first-frame auth handshake**
The bearer token is sent as the first WebSocket text frame (`{"type":"auth","token":"<JWT>"}`) rather than as a URL query parameter. This keeps the credential out of web server access logs and browser history, which record the full URL including the query string. The server closes with code `1008` (Policy Violation) if the frame is missing, malformed, or carries an invalid token, which the client interprets as a permanent failure (stops reconnecting). The 5-second handshake timeout prevents resource leaks from half-open connections.

**Why WebSockets over polling?**
The event simulator fires every 8 seconds. Polling at sub-10 s intervals from an operations console with dozens of concurrent clients produces a thundering herd on every tick. A single persistent WebSocket per client — with React Query invalidation on push — keeps the UI fresh without the overhead.

**Why Leaflet instead of a dedicated mapping SDK?**
CartoDB Dark Matter tiles are free and require no API key, which keeps the demo self-contained. Custom `divIcon` markers colored by asset status and ephemeral `Circle` pulse rings (6 s auto-dismiss) demonstrate the map is live-data-wired, not decorative. Adding a satellite layer or a heatmap overlay would be a straightforward extension.

**Incident state machine enforcement**
The allowed transitions are:

```
open → acknowledged
acknowledged → resolved | open
resolved → open
```

Enforced on the backend — invalid transitions return `422 Unprocessable Entity` with a descriptive message. The frontend mirrors this logic to hide inapplicable action buttons, but the backend is the authority. Viewers receive `403 Forbidden` on any status mutation regardless of the proposed transition.
