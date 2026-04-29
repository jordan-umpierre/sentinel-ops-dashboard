"""
Dashboard endpoint tests.

Covers the overview snapshot and the 24-hour event activity histogram.
These are read-only endpoints; tests verify shape and business-logic constraints
rather than exact values (which change as the simulator runs).
"""

from fastapi.testclient import TestClient


class TestDashboardOverview:
    def test_returns_overview_shape(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/dashboard/overview", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        for section in ("site", "metrics", "assets", "incidents", "recent_events"):
            assert section in body, f"missing section: {section}"

    def test_site_fields_present(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        body = client.get("/api/dashboard/overview", headers=auth_headers).json()
        site = body["site"]
        for field in ("id", "name", "code", "region", "description"):
            assert field in site

    def test_metrics_fields_are_non_negative(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        body = client.get("/api/dashboard/overview", headers=auth_headers).json()
        metrics = body["metrics"]
        for field in (
            "active_incidents",
            "critical_events_today",
            "assets_monitored",
            "assets_in_alert",
            "system_health_percent",
        ):
            assert field in metrics
            assert metrics[field] >= 0, f"{field} should be non-negative"

    def test_assets_list_populated(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        body = client.get("/api/dashboard/overview", headers=auth_headers).json()
        assert len(body["assets"]) >= 5  # seeded with 5 assets

    def test_requires_auth(self, client: TestClient) -> None:
        resp = client.get("/api/dashboard/overview")
        assert resp.status_code in (401, 403)


class TestEventActivity:
    def test_returns_activity_shape(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/dashboard/activity", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "buckets" in body
        assert "total_24h" in body
        assert "peak_hour" in body

    def test_returns_24_hour_buckets(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        body = client.get("/api/dashboard/activity", headers=auth_headers).json()
        buckets = body["buckets"]
        assert len(buckets) == 24

    def test_buckets_cover_full_hour_range(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        body = client.get("/api/dashboard/activity", headers=auth_headers).json()
        hours = {b["hour"] for b in body["buckets"]}
        assert hours == set(range(24)), "buckets must cover hours 0–23"

    def test_bucket_counts_non_negative(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        body = client.get("/api/dashboard/activity", headers=auth_headers).json()
        for bucket in body["buckets"]:
            assert bucket["count"] >= 0

    def test_total_equals_sum_of_buckets(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        body = client.get("/api/dashboard/activity", headers=auth_headers).json()
        assert body["total_24h"] == sum(b["count"] for b in body["buckets"])

    def test_requires_auth(self, client: TestClient) -> None:
        resp = client.get("/api/dashboard/activity")
        assert resp.status_code in (401, 403)
