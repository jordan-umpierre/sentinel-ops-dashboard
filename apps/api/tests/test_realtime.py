"""Realtime websocket endpoint tests.

These cover the first-frame auth handshake without relying on the simulator.
The server accepts the socket, waits for an auth JSON frame, and closes with
1008 when credentials are missing or invalid.
"""

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect


def test_websocket_accepts_valid_first_frame_auth(
    client: TestClient,
    operator_token: str,
) -> None:
    with client.websocket_connect("/api/realtime/events") as websocket:
        websocket.send_json({"type": "auth", "token": operator_token})
        websocket.send_text("client-ready")


def test_websocket_rejects_invalid_token(client: TestClient) -> None:
    with client.websocket_connect("/api/realtime/events") as websocket:
        websocket.send_json({"type": "auth", "token": "not.a.valid.jwt"})
        with pytest.raises(WebSocketDisconnect) as exc_info:
            websocket.receive_text()
        assert exc_info.value.code == 1008


def test_websocket_rejects_malformed_first_frame(client: TestClient) -> None:
    with client.websocket_connect("/api/realtime/events") as websocket:
        websocket.send_text("{")
        with pytest.raises(WebSocketDisconnect) as exc_info:
            websocket.receive_text()
        assert exc_info.value.code == 1008
