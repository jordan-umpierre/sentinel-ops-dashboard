"""
Pytest configuration and shared fixtures for the Sentinel API test suite.

Strategy: set DATABASE_URL and SIMULATOR_ENABLED at module level *before* any
app code is imported. conftest.py is always loaded by pytest before test
modules, so the env vars are in place when SQLAlchemy creates its engine and
when pydantic-settings reads the configuration.
"""

import os

# These must come before any app.* imports. They redirect all DB activity to a
# dedicated test file so tests never touch the dev database.
os.environ["DATABASE_URL"] = "sqlite:///./tests/sentinel-test.db"
os.environ["SIMULATOR_ENABLED"] = "false"

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session", autouse=True)
def clean_test_db():
    """Remove any leftover test DB before the session starts and after it ends.

    Using a file-based SQLite (rather than :memory:) lets the TestClient lifespan
    call create_all and seed_demo_data exactly once via the real application path.
    StaticPool tricks are not needed and this approach is easy to explain.
    """
    db_path = "./tests/sentinel-test.db"
    if os.path.exists(db_path):
        os.remove(db_path)
    yield
    if os.path.exists(db_path):
        os.remove(db_path)


@pytest.fixture(scope="session")
def client():
    """Build the FastAPI test client once for the whole session.

    Scope is session because the lifespan (schema creation + seeding) is
    idempotent and expensive enough that running it per-test would slow things
    down without adding isolation value. Mutation tests that modify seeded data
    are designed to remain idempotent (e.g. status tests cycle back to open).
    """
    from app.main import create_app

    app = create_app()
    with TestClient(app) as c:
        yield c


# ── Token fixtures ──────────────────────────────────────────────────────────
# Each role gets its own session-scoped token so HTTP calls in tests look
# exactly like real frontend calls and the JWT validation path is exercised.

@pytest.fixture(scope="session")
def operator_token(client: TestClient) -> str:
    resp = client.post(
        "/api/auth/login",
        json={"email": "operator@sentinel.dev", "password": "sentinel123"},
    )
    assert resp.status_code == 200, f"operator login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token(client: TestClient) -> str:
    resp = client.post(
        "/api/auth/login",
        json={"email": "admin@sentinel.dev", "password": "sentinel123"},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def viewer_token(client: TestClient) -> str:
    resp = client.post(
        "/api/auth/login",
        json={"email": "viewer@sentinel.dev", "password": "sentinel123"},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(operator_token: str) -> dict:
    """Convenience header dict for operator-authenticated requests."""
    return {"Authorization": f"Bearer {operator_token}"}


@pytest.fixture(scope="session")
def admin_headers(admin_token: str) -> dict:
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def viewer_headers(viewer_token: str) -> dict:
    return {"Authorization": f"Bearer {viewer_token}"}
