import json
from typing import Any

from fastapi import WebSocket


class EventConnectionManager:
    """Tracks browser websocket connections for live operational events.

    The simulator and API routes do not know about React, browser tabs, or
    websocket lifecycle details. They publish structured payloads here, and this
    manager handles fan-out to every connected dashboard.
    """

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register a websocket connection."""

        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a websocket connection if the browser disconnects."""

        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        """Send one JSON payload to every connected browser.

        Failed sends are pruned so a stale tab cannot break the simulator loop or
        block updates to healthy clients.
        """

        disconnected: list[WebSocket] = []
        message = json.dumps(payload, default=str)
        for websocket in self.active_connections:
            try:
                await websocket.send_text(message)
            except Exception:
                disconnected.append(websocket)

        for websocket in disconnected:
            self.disconnect(websocket)


event_connection_manager = EventConnectionManager()
