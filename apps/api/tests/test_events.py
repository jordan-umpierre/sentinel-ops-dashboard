"""
Event history endpoint tests.

Covers pagination mechanics, filter combinations, and sort order.
All tests are read-only and safe to run in any order.
"""

from fastapi.testclient import TestClient


class TestEventList:
    def test_returns_paginated_response(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/events", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "pagination" in body
        pagination = body["pagination"]
        for field in ("page", "page_size", "total", "total_pages"):
            assert field in pagination

    def test_default_page_is_one(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/events", headers=auth_headers)
        assert resp.json()["pagination"]["page"] == 1

    def test_filter_by_severity_high(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/events?severity=high", headers=auth_headers)
        assert resp.status_code == 200
        for event in resp.json()["items"]:
            assert event["severity"] == "high"

    def test_filter_by_event_type(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get(
            "/api/events?event_type=access_denied", headers=auth_headers
        )
        assert resp.status_code == 200
        for event in resp.json()["items"]:
            assert event["event_type"] == "access_denied"

    def test_filter_by_time_window(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        # The seeded events are all within the last hour
        resp = client.get("/api/events?since_hours=1", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()["items"]) >= 1

    def test_sort_oldest_first(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/events?sort=oldest&page_size=50", headers=auth_headers)
        assert resp.status_code == 200
        items = resp.json()["items"]
        if len(items) >= 2:
            # occurred_at strings are ISO8601; lexicographic comparison works.
            assert items[0]["occurred_at"] <= items[-1]["occurred_at"]

    def test_sort_newest_first(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/events?sort=newest&page_size=50", headers=auth_headers)
        assert resp.status_code == 200
        items = resp.json()["items"]
        if len(items) >= 2:
            assert items[0]["occurred_at"] >= items[-1]["occurred_at"]

    def test_page_size_respected(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/events?page_size=2", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()["items"]) <= 2

    def test_second_page_returns_next_items(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        page1 = client.get(
            "/api/events?page=1&page_size=2&sort=oldest", headers=auth_headers
        ).json()["items"]
        page2 = client.get(
            "/api/events?page=2&page_size=2&sort=oldest", headers=auth_headers
        ).json()["items"]
        if page1 and page2:
            assert page1[0]["id"] != page2[0]["id"]

    def test_requires_auth(self, client: TestClient) -> None:
        resp = client.get("/api/events")
        assert resp.status_code in (401, 403)
