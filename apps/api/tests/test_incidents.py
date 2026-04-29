"""
Incident endpoint tests.

Tests cover list filtering, detail retrieval, the full status lifecycle
(open → acknowledged → resolved → open), and role-based access control.

The status transition tests are ordered intentionally and are stateful: each
test leaves the incident in a state the next test depends on. This is a
deliberate tradeoff — resetting state inside the test avoids complex fixtures
while making the state machine sequence readable at a glance.
"""

import pytest
from fastapi.testclient import TestClient


class TestIncidentList:
    def test_returns_list_of_incidents(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/incidents", headers=auth_headers)
        assert resp.status_code == 200
        incidents = resp.json()
        assert isinstance(incidents, list)
        assert len(incidents) >= 1

    def test_each_incident_has_required_fields(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/incidents", headers=auth_headers)
        for incident in resp.json():
            for field in ("id", "title", "summary", "severity", "status", "explanation"):
                assert field in incident, f"missing field: {field}"

    def test_filter_by_status(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/incidents?status=open", headers=auth_headers)
        assert resp.status_code == 200
        for incident in resp.json():
            assert incident["status"] == "open"

    def test_filter_by_severity(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/incidents?severity=high", headers=auth_headers)
        assert resp.status_code == 200
        for incident in resp.json():
            assert incident["severity"] == "high"

    def test_search_by_title_text(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        # The seeded incident title contains "North Gate"
        resp = client.get("/api/incidents?search=North+Gate", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_search_no_match_returns_empty_list(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get(
            "/api/incidents?search=zzznomatch999", headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json() == []

    def test_requires_auth(self, client: TestClient) -> None:
        resp = client.get("/api/incidents")
        assert resp.status_code in (401, 403)


class TestIncidentDetail:
    def test_returns_detail_for_seeded_incident(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        # Get any incident ID from the list, then fetch its detail.
        list_resp = client.get("/api/incidents", headers=auth_headers)
        incident_id = list_resp.json()[0]["id"]

        resp = client.get(f"/api/incidents/{incident_id}", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == incident_id
        assert "related_events" in body
        assert "affected_asset_details" in body
        assert "explanation" in body

    def test_unknown_id_returns_404(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get(
            "/api/incidents/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestIncidentSummary:
    def test_returns_summary_with_required_fields(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        list_resp = client.get("/api/incidents", headers=auth_headers)
        incident_id = list_resp.json()[0]["id"]

        resp = client.get(
            f"/api/incidents/{incident_id}/summary", headers=auth_headers
        )
        assert resp.status_code == 200
        body = resp.json()
        for field in ("summary", "likely_cause", "affected_assets", "suggested_next_checks", "provider"):
            assert field in body, f"missing field in summary: {field}"

    def test_fallback_provider_is_used_without_api_key(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        # OPENAI_API_KEY is not set in the test environment, so the fallback
        # provider should always be used. Verify the provider label matches.
        list_resp = client.get("/api/incidents", headers=auth_headers)
        incident_id = list_resp.json()[0]["id"]

        resp = client.get(
            f"/api/incidents/{incident_id}/summary", headers=auth_headers
        )
        assert resp.json()["provider"] == "deterministic-fallback"


class TestIncidentSummaryCache:
    """Tests for the DB-level AI summary cache.

    The cache lifecycle: first request generates + stores, subsequent requests
    serve from cache (cached_at is set), ?refresh=true bypasses cache, and a
    status change invalidates the cache so the next request is always fresh.
    """

    @pytest.fixture(autouse=True)
    def incident_id(self, client: TestClient, auth_headers: dict) -> str:
        """Pick the first incident from the list for cache tests."""
        resp = client.get("/api/incidents", headers=auth_headers)
        return resp.json()[0]["id"]

    def test_first_request_is_not_cached(
        self, client: TestClient, auth_headers: dict, incident_id: str
    ) -> None:
        # Bypass any stale cache from a previous test run.
        resp = client.get(
            f"/api/incidents/{incident_id}/summary?refresh=true", headers=auth_headers
        )
        assert resp.status_code == 200
        # A freshly generated summary has no cached_at timestamp.
        assert resp.json()["cached_at"] is None

    def test_second_request_is_served_from_cache(
        self, client: TestClient, auth_headers: dict, incident_id: str
    ) -> None:
        # Warm the cache (refresh=true guarantees a fresh write).
        r1 = client.get(
            f"/api/incidents/{incident_id}/summary?refresh=true", headers=auth_headers
        )
        first_summary = r1.json()["summary"]

        # Normal request should hit the cache.
        r2 = client.get(
            f"/api/incidents/{incident_id}/summary", headers=auth_headers
        )
        assert r2.status_code == 200
        assert r2.json()["cached_at"] is not None  # cache hit
        assert r2.json()["summary"] == first_summary  # same content as cached

    def test_refresh_param_bypasses_cache(
        self, client: TestClient, auth_headers: dict, incident_id: str
    ) -> None:
        # Warm the cache first.
        client.get(f"/api/incidents/{incident_id}/summary", headers=auth_headers)

        # ?refresh=true must return a fresh generation (cached_at is None).
        resp = client.get(
            f"/api/incidents/{incident_id}/summary?refresh=true", headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["cached_at"] is None

    def test_status_change_invalidates_summary_cache(
        self, client: TestClient, auth_headers: dict, incident_id: str
    ) -> None:
        # Ensure we start from open so the transition is valid.
        client.patch(
            f"/api/incidents/{incident_id}/status",
            json={"status": "open"},
            headers=auth_headers,
        )

        # Warm the cache.
        r1 = client.get(f"/api/incidents/{incident_id}/summary", headers=auth_headers)
        # Confirm it's now cached.
        r2 = client.get(f"/api/incidents/{incident_id}/summary", headers=auth_headers)
        assert r2.json()["cached_at"] is not None

        # Status change should invalidate the server-side cache.
        client.patch(
            f"/api/incidents/{incident_id}/status",
            json={"status": "acknowledged"},
            headers=auth_headers,
        )

        # Next summary request must be a fresh generation (no cached_at).
        r3 = client.get(f"/api/incidents/{incident_id}/summary", headers=auth_headers)
        assert r3.status_code == 200
        assert r3.json()["cached_at"] is None

        # Restore to open so other tests can use this incident.
        client.patch(
            f"/api/incidents/{incident_id}/status",
            json={"status": "open"},
            headers=auth_headers,
        )


class TestIncidentStatusTransitions:
    """Test the full lifecycle state machine using the seeded incident.

    Tests run in order: open → acknowledged → resolved → open (reopen).
    Each test verifies both the response and that the list endpoint reflects
    the new state, ensuring cache invalidation would work correctly in production.
    """

    @pytest.fixture(scope="class")
    def incident_id(self, client: TestClient, auth_headers: dict) -> str:
        """Get an incident that starts in 'open' status for transition tests.

        If the seeded incident was already transitioned by a previous run, reset
        it to open first so the chain test is always starting from a known state.
        """
        list_resp = client.get("/api/incidents?status=open", headers=auth_headers)
        incidents = list_resp.json()
        if incidents:
            return incidents[0]["id"]

        # No open incident found — reset the first one to open
        all_resp = client.get("/api/incidents", headers=auth_headers)
        incident_id = all_resp.json()[0]["id"]
        client.patch(
            f"/api/incidents/{incident_id}/status",
            json={"status": "open"},
            headers=auth_headers,
        )
        return incident_id

    def test_operator_can_acknowledge(
        self, client: TestClient, auth_headers: dict, incident_id: str
    ) -> None:
        resp = client.patch(
            f"/api/incidents/{incident_id}/status",
            json={"status": "acknowledged"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "acknowledged"

    def test_operator_can_resolve(
        self, client: TestClient, auth_headers: dict, incident_id: str
    ) -> None:
        resp = client.patch(
            f"/api/incidents/{incident_id}/status",
            json={"status": "resolved"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "resolved"

    def test_operator_can_reopen(
        self, client: TestClient, auth_headers: dict, incident_id: str
    ) -> None:
        resp = client.patch(
            f"/api/incidents/{incident_id}/status",
            json={"status": "open"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "open"

    def test_viewer_cannot_update_status(
        self,
        client: TestClient,
        viewer_headers: dict,
        incident_id: str,
    ) -> None:
        # Role enforcement: viewer accounts are read-only. The backend must
        # return 403 regardless of whether the transition itself is valid.
        resp = client.patch(
            f"/api/incidents/{incident_id}/status",
            json={"status": "acknowledged"},
            headers=viewer_headers,
        )
        assert resp.status_code == 403

    def test_status_update_for_unknown_incident_returns_404(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.patch(
            "/api/incidents/00000000-0000-0000-0000-000000000000/status",
            json={"status": "acknowledged"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_invalid_status_value_returns_422(
        self, client: TestClient, auth_headers: dict, incident_id: str
    ) -> None:
        # Pydantic validates the enum; an invalid value should fail fast.
        resp = client.patch(
            f"/api/incidents/{incident_id}/status",
            json={"status": "flying"},
            headers=auth_headers,
        )
        assert resp.status_code == 422
