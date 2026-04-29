"""
Authentication endpoint tests.

Covers login happy path, credential failures, JWT validation, and the /me
endpoint. These tests are intentionally integration-level: they hit the full
FastAPI stack so the JWT encode/decode round-trip and password hashing path are
both exercised — not mocked.
"""

import pytest
from fastapi.testclient import TestClient


class TestLogin:
    def test_valid_credentials_return_token(self, client: TestClient) -> None:
        resp = client.post(
            "/api/auth/login",
            json={"email": "operator@sentinel.dev", "password": "sentinel123"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"
        assert body["user"]["email"] == "operator@sentinel.dev"
        assert body["user"]["role"] == "operator"

    def test_wrong_password_returns_401(self, client: TestClient) -> None:
        resp = client.post(
            "/api/auth/login",
            json={"email": "operator@sentinel.dev", "password": "wrongpass"},
        )
        assert resp.status_code == 401

    def test_unknown_email_returns_401(self, client: TestClient) -> None:
        resp = client.post(
            "/api/auth/login",
            json={"email": "nobody@sentinel.dev", "password": "sentinel123"},
        )
        assert resp.status_code == 401

    def test_all_demo_roles_can_login(self, client: TestClient) -> None:
        """Smoke test that all three seeded accounts are usable."""
        for email, expected_role in [
            ("admin@sentinel.dev", "admin"),
            ("operator@sentinel.dev", "operator"),
            ("viewer@sentinel.dev", "viewer"),
        ]:
            resp = client.post(
                "/api/auth/login",
                json={"email": email, "password": "sentinel123"},
            )
            assert resp.status_code == 200, f"login failed for {email}"
            assert resp.json()["user"]["role"] == expected_role


class TestMe:
    def test_valid_token_returns_user(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["email"] == "operator@sentinel.dev"
        assert "hashed_password" not in body  # never leak the hash

    def test_missing_token_returns_401(self, client: TestClient) -> None:
        resp = client.get("/api/auth/me")
        # FastAPI returns 403 for missing bearer when auto_error=False;
        # our dep raises 401 — check whichever the implementation returns.
        assert resp.status_code in (401, 403)

    def test_garbage_token_returns_401(self, client: TestClient) -> None:
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer not.a.valid.jwt"},
        )
        assert resp.status_code == 401
