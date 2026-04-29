from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_assets import router as assets_router
from app.api.routes_auth import router as auth_router
from app.api.routes_dashboard import router as dashboard_router
from app.api.routes_events import router as events_router
from app.api.routes_health import router as health_router
from app.api.routes_incidents import router as incidents_router
from app.core.config import settings
from app.core.database import Base, engine
from app.services.seed import seed_demo_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Prepare the demo database before the API starts accepting traffic.

    Phase 1 keeps migrations intentionally light so the repo remains easy to run
    on a fresh machine. Alembic can be introduced once the data model starts
    changing across later phases, but for the initial demo we create the schema
    and seed deterministic records at startup.
    """

    Base.metadata.create_all(bind=engine)
    seed_demo_data()
    yield


def create_app() -> FastAPI:
    """Build the FastAPI application with all cross-cutting concerns attached.

    Keeping construction in a function makes testing easier because tests can
    import `create_app()` without triggering module-level side effects beyond
    settings loading.
    """

    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.API_VERSION,
        description="Backend API for Sentinel's operational awareness dashboard.",
        lifespan=lifespan,
    )

    # CORS is intentionally explicit: the frontend dev server and deployed
    # frontend origin can be configured without opening the API to every domain.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Route modules are grouped by product capability so Phase 2 can add richer
    # assets, incidents, and event-history APIs without crowding this file.
    app.include_router(health_router, prefix="/api")
    app.include_router(auth_router, prefix="/api/auth")
    app.include_router(dashboard_router, prefix="/api/dashboard")
    app.include_router(assets_router, prefix="/api/assets")
    app.include_router(events_router, prefix="/api/events")
    app.include_router(incidents_router, prefix="/api/incidents")
    return app


app = create_app()
