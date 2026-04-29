"""
Asset endpoint tests.

Covers list filtering, sorting, search, and the detail drawer endpoint.
All tests are read-only so session-scoped fixtures can be shared safely.
"""

from fastapi.testclient import TestClient


class TestAssetList:
    def test_returns_all_assets(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/assets", headers=auth_headers)
        assert resp.status_code == 200
        assets = resp.json()
        assert isinstance(assets, list)
        assert len(assets) >= 5  # seeded with 5 assets

    def test_each_asset_has_required_fields(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/assets", headers=auth_headers)
        for asset in resp.json():
            for field in (
                "id", "name", "call_sign", "asset_type",
                "status", "zone", "battery_level", "last_seen_at",
            ):
                assert field in asset, f"missing field: {field}"

    def test_filter_by_status(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/assets?status=alert", headers=auth_headers)
        assert resp.status_code == 200
        for asset in resp.json():
            assert asset["status"] == "alert"

    def test_filter_by_asset_type(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/assets?asset_type=sensor", headers=auth_headers)
        assert resp.status_code == 200
        for asset in resp.json():
            assert asset["asset_type"] == "sensor"

    def test_search_by_call_sign(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/assets?search=GATE-3", headers=auth_headers)
        assert resp.status_code == 200
        assets = resp.json()
        assert len(assets) >= 1
        assert any("GATE-3" in a["call_sign"] for a in assets)

    def test_sort_by_battery_returns_ordered_results(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        # Battery sorts descending (highest first) so operators see the
        # most-charged assets first — consistent with the backend implementation.
        resp = client.get("/api/assets?sort=battery", headers=auth_headers)
        assert resp.status_code == 200
        levels = [a["battery_level"] for a in resp.json()]
        assert levels == sorted(levels, reverse=True)

    def test_search_no_match_returns_empty_list(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get("/api/assets?search=ZZZNOTANASSET", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_requires_auth(self, client: TestClient) -> None:
        resp = client.get("/api/assets")
        assert resp.status_code in (401, 403)


class TestAssetDetail:
    def test_returns_detail_with_history(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        list_resp = client.get("/api/assets", headers=auth_headers)
        asset_id = list_resp.json()[0]["id"]

        resp = client.get(f"/api/assets/{asset_id}", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == asset_id
        assert "recent_events" in body
        assert "related_incidents" in body
        assert "metadata" in body

    def test_unknown_id_returns_404(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        resp = client.get(
            "/api/assets/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert resp.status_code == 404
