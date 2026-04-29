You are building a portfolio-grade full-stack web application for a recent Computer Science graduate targeting entry-level software engineering roles at companies that work on real-time operational software, sensor/telemetry integration, data visualization, and decision-support systems.

The app should feel like a serious operational product, not a toy CRUD app.

PROJECT NAME
Sentinel — Real-Time Operational Awareness Dashboard

PRIMARY GOAL
Build a polished full-stack application that simulates a live operational environment where users monitor assets, events, alerts, and site conditions in real time.

This project must be good enough to:
1. stand out on a resume and GitHub,
2. demo in interviews,
3. show strong software engineering fundamentals,
4. communicate product thinking, system design, and practical engineering tradeoffs.

CORE PRODUCT CONCEPT
Users should be able to:
- view a live dashboard of incoming events
- monitor assets/personnel/vehicles/sensors
- see incidents and alerts update in real time
- filter/search event history
- inspect a site/asset detail panel
- understand why an alert fired
- view AI-generated incident summaries
- interact with a realistic “common operating picture” UI

DO NOT BUILD
- a generic to-do app
- an ecommerce clone
- unnecessary microservices
- a huge enterprise auth system
- premature complexity
- unnecessary third-party dependencies if built-in options are sufficient

TECH STACK DEFAULTS
Use the following unless there is a very strong reason not to:
- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS
- UI components: clean custom components or a lightweight component library if helpful
- Backend: FastAPI in Python
- Database: PostgreSQL
- Realtime: WebSockets
- ORM / DB access: SQLAlchemy or equivalent clean ORM/tooling
- Auth: simple JWT-based auth with seeded demo users
- Dev environment: Docker + docker-compose
- Charts/maps: choose practical libraries that are stable and easy to explain
- Testing: practical unit/integration coverage, not excessive ceremony

WHY THIS STACK
Choose tools that make the project credible, modern, and easy to explain in an interview. Favor clarity, maintainability, and deployability over novelty.

PRODUCT STORY / DOMAIN
Simulate an operational environment such as:
- secure facility
- airfield
- spaceport
- logistics hub
- industrial site
- construction zone

The system should ingest simulated event streams such as:
- geofence breaches
- badge/access failures
- equipment offline events
- environmental threshold alerts
- suspicious movement
- route deviations
- high temperature / low battery / sensor dropout
- restricted-area entry
- incident escalation triggered by multiple correlated events

The app should feel like it is used by an operator or analyst monitoring a live environment.

MVP FEATURES
Build v1 with these core sections:

1. AUTH + DEMO ACCESS
- login page
- seeded demo accounts for admin/operator/viewer
- route protection
- role-aware UI where helpful

2. MAIN DASHBOARD
- KPI summary cards
- live alert feed
- active incidents panel
- asset status summary
- recent event stream
- system health / site condition widgets

3. ASSETS / PERSONNEL / EQUIPMENT VIEW
- tabular list with filters and search
- status badges
- sortable columns
- click row to open detail drawer/panel

4. INCIDENTS VIEW
- incident list
- severity levels
- open / acknowledged / resolved state
- timeline of related events
- “why this alert fired” explanation section

5. SITE / MAP / DIGITAL TWIN STYLE VIEW
- a simplified site visualization or map-like view
- assets/sensors displayed spatially
- clicking an item opens state/details/history
- this does not need to be a true 3D twin; a strong 2D operational layout is enough

6. EVENT INGESTION + SIMULATION
- backend simulator that emits realistic events continuously
- multiple event types and severity levels
- timestamps, entity references, and location metadata
- websocket updates to the frontend

7. AI INCIDENT SUMMARY PANEL
- for each incident, generate:
  - concise summary
  - likely cause
  - affected assets
  - suggested next checks
- architect this behind a provider interface so the AI layer can be swapped later
- if no API key is configured, fall back to deterministic mocked summaries so the app still works

8. EVENT HISTORY SEARCH
- search/filter by asset, time, incident type, severity, status
- pagination
- clean query handling

9. AUDITABILITY / EXPLAINABILITY
- show related events that triggered each alert
- preserve event history
- make logic understandable in the UI

NON-FUNCTIONAL REQUIREMENTS
- clean architecture
- readable folder structure
- consistent naming
- strong TypeScript typing
- sensible backend schemas/models
- robust loading/empty/error states
- polished UX
- mobile responsiveness is nice, but desktop-first is fine
- no fake complexity
- no giant code dumps without structure

DESIGN DIRECTION
The design should feel:
- high signal
- modern
- operator-focused
- dark mode by default
- sharp, clean, technical
- visually impressive without being cluttered

Visual style ideas:
- dark dashboard UI
- crisp cards and panels
- restrained accent colors for severity/status
- strong hierarchy and spacing
- polished tables, timelines, drawers, filters
- subtle motion, not gimmicky
- realistic demo data

ARCHITECTURE REQUIREMENTS
Create the project with a structure that separates:
- frontend app
- backend API
- simulation service/module
- shared contracts/types if useful
- database models + migrations
- AI summary service abstraction

Frontend guidance:
- use component composition
- separate pages, widgets, and domain components
- avoid monolithic files
- keep state management simple; use React Query and local state unless a stronger reason exists

Backend guidance:
- REST endpoints for history/read operations
- WebSocket stream for live events
- incident generation/correlation logic
- clean service layer
- seeded database/demo data
- environment variable config
- health endpoint

DATA MODEL GUIDANCE
Include entities like:
- Site
- Asset
- Sensor
- Person / Operator
- Event
- Incident
- Alert
- User
- EventCorrelation / IncidentEvent link table if useful

Each event should include:
- id
- timestamp
- type
- severity
- source
- related entity/entity type
- optional coordinates or site zone
- metadata payload

Each incident should include:
- id
- title
- summary
- severity
- status
- created_at
- updated_at
- related events
- affected entities
- explanation

BUILD STRATEGY
Work in phases. Do not try to do everything at once.

PHASE 1
- scaffold frontend and backend
- set up Docker
- create DB models
- create seeded demo data
- implement auth
- implement main layout/navigation

PHASE 2
- build dashboard widgets
- build asset list/detail view
- build incident list/detail view
- build event history endpoints and UI

PHASE 3
- add simulator
- add websocket live updates
- connect live feed to dashboard and incident UI

PHASE 4
- add AI summary abstraction and mocked fallback
- add alert explanation UI
- improve UX polish

PHASE 5
- add tests
- improve docs
- create demo script
- refine visuals and performance

IMPORTANT IMPLEMENTATION RULES
- At each phase, keep the app runnable
- Commit work in logical chunks if git is enabled
- Add a concise README as the project evolves
- Document setup clearly
- Prefer a working polished subset over unfinished sprawl
- If a feature choice is ambiguous, choose the option that best improves portfolio value and demo quality
- Keep generated code production-style and interview-defensible

README REQUIREMENTS
Create a strong README including:
- project overview
- why this project exists
- architecture diagram or section
- stack explanation
- local setup
- demo users
- feature walkthrough
- screenshots section placeholders
- future improvements
- resume bullet suggestions

PORTFOLIO / RESUME POSITIONING
This project should clearly support claims like:
- built a real-time full-stack operational dashboard
- implemented live event ingestion and alerting
- designed incident workflows and explainable alert logic
- integrated AI-generated summaries behind a provider abstraction
- used Docker, PostgreSQL, WebSockets, React, and FastAPI in a cohesive system

HOW TO OPERATE
First, inspect the repository and propose the file/folder structure and implementation plan.
Then begin building Phase 1 immediately.
After each phase, summarize:
- what was completed
- what remains
- what commands to run
- any tradeoffs made

FINAL QUALITY BAR
The finished project should look like something a sharp junior engineer built to target serious software teams working on telemetry, security, operations, logistics, robotics, or mission-oriented systems.

Do not be lazy. Do not collapse everything into simplistic demo code. Build this like a real portfolio centerpiece.