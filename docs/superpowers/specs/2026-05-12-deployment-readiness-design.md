# Deployment-Readiness Audit & Fix Plan

**Date:** 2026-05-12
**Goal:** Bring Sentinel to full readiness for (1) live hosted demo URL, (2) clean local clone-and-run, and (3) screen-share interview demo.

---

## Baseline state

Everything that currently exists passes:

- Backend: 75 pytest tests pass against SQLite test DB (~9s).
- Backend: `ruff check .` clean.
- Frontend: `eslint --max-warnings 0` clean.
- Frontend: `tsc --noEmit` + `vite build` clean (448 KB JS / 131 KB gzipped).
- CI: GitHub Actions runs both suites against Postgres on every push.

This is a high-quality codebase. The remaining work is deployment plumbing and a small set of polish items — not bug-fixing a broken project.

---

## Findings

### P0 — blocks live deployment

1. **No production deploy configuration.** No `fly.toml`, no `vercel.json`, no production env recipe. Project boots only locally or via docker-compose.
2. **`apps/web/Dockerfile` runs `vite --host` (dev server).** Not deployable as a production container. Frontend will deploy to Vercel instead — but the Dockerfile should be either removed or fixed so it doesn't mislead reviewers.
3. **API Dockerfile binds port 8000 hardcoded.** Fly.io passes `$PORT`; the CMD should respect it.
4. **CORS_ORIGINS default only includes localhost.** Production deploy must inject the Vercel domain.
5. **Frontend `VITE_API_BASE_URL` defaults to `http://localhost:8000`.** Vercel build must inject the live API origin at build time, or the prod bundle calls localhost.
6. **No Postgres in production path on the demo side.** `Base.metadata.create_all()` works against managed Postgres but Alembic exists and isn't wired into the deploy. Decision needed.

### P1 — visible quality / interview talking points

7. **`pyproject.toml` `target-version = "py39"` and `requires-python = ">=3.9"`** while CI and Dockerfile both use 3.12. Align to 3.12.
8. **`seed.py` comment still says "portfolio demo"** (line ~41) — README was scrubbed of portfolio framing; this comment should match.
9. **AssetsPage / IncidentsPage**: when a filter excludes the currently-selected ID, the detail panel keeps fetching/showing it. Reset selection when it's no longer in the filtered list.
10. **No frontend tests.** README explicitly lists Vitest tests as Phase 5+ polish. Add a minimal Vitest setup with 2–3 component tests (live event reducer, role-aware action buttons). Interview-relevant.
11. **No request-id correlation in logs.** Minor, but a real-deployment hint.
12. **`Web` Dockerfile + docker-compose `web` service is dev-only.** Either remove the web service from `docker-compose.yml` and document Vercel for prod, or build static and serve via nginx. Recommended: keep dev-only for local-with-docker, document clearly.

### P2 — nice-to-have, deferred

- Code-split Leaflet (bundle is 448 KB, mostly map+react).
- Rate limiting.
- JSON-structured logs in prod.
- WebSocket exponential backoff (currently fixed 3 s).
- AssetDetail panel: gracefully degrades but shows stale data if backend returns 404 for the previously-selected id after filtering.

These do not affect deployment or demo quality. Skip for now; note in a follow-ups section of README.

---

## Fix plan

Order matters — fixes 1–4 land before deploy configs go in.

1. **Strip the residual "portfolio" comment in `seed.py`.** One-line edit.
2. **Bump Python target in `pyproject.toml` to 3.12** (matches CI and Dockerfile).
3. **Filter-aware selection in AssetsPage and IncidentsPage** — clear `selectedAssetId`/`selectedIncidentId` when it's no longer in the filtered result.
4. **Add minimal Vitest setup** — install `vitest`, `@testing-library/react`, `jsdom`. Add 2–3 component tests covering: severity tone mapping, status action button visibility by role, live event provider basic state.
5. **Fix API Dockerfile** to honor `$PORT` (`CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]`).
6. **Add `fly.toml`** for the API service. Internal port 8000, http_service on 443, health check on `/api/health`.
7. **Add a deploy entrypoint that runs `alembic upgrade head` before starting uvicorn.** Replaces relying on `create_all()` in prod (it still runs on startup, which is fine — `create_all()` is idempotent — but Alembic ensures the operational-indexes migration runs against managed Postgres).
8. **Add `vercel.json`** at repo root: Vercel installs from `apps/web`, builds with `npm run build`, serves `apps/web/dist`. SPA rewrite to `index.html`.
9. **Document deploy in README** with exact `fly secrets set`, `fly deploy`, and Vercel env-var commands. Include actual demo URLs once deployed.
10. **Update `docker-compose.yml`** to document the `web` service as dev-only (comment) and align `CORS_ORIGINS` env handling for prod.
11. **Add CI job** that runs frontend Vitest suite.
12. **Final pass**: run all checks, commit in logical chunks, deploy, verify live, update README with URLs.

---

## Hosting decision

- **Frontend:** Vercel. Free tier, automatic HTTPS, instant deploys from main branch, best-in-class for React/Vite. No Docker.
- **API + DB:** Fly.io.
  - WebSocket support (long-lived TCP connections — Railway works too but Fly is documented better for this).
  - Free Postgres instance via `fly postgres create`.
  - Single platform for app + DB simplifies the demo.

---

## Out of scope

- New product features beyond what's listed above.
- Refactoring well-functioning code.
- Replacing libraries.
- Visual redesign — the existing UI is already strong.

---

## Acceptance criteria

- `https://<vercel-domain>` loads the login page over HTTPS.
- All three demo accounts log in successfully and reach role-appropriate views.
- WebSocket connects (green "LIVE" indicator in header).
- Simulator fires events; map pulses + toast appears; React Query invalidates.
- AI summary endpoint returns deterministic-fallback responses (since no `OPENAI_API_KEY` set in prod by default).
- CSV export downloads.
- Viewer account cannot mutate incident status (button hidden + backend 403).
- README contains live URLs and a clear walkthrough.
- All tests still pass; lint + build still clean.
