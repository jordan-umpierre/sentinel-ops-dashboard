from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.domain.models import User
from app.services.realtime import event_connection_manager


router = APIRouter(tags=["realtime"])


def _token_belongs_to_user(token: str) -> bool:
    """Validate websocket query-token auth for browser clients.

    Browsers cannot attach arbitrary Authorization headers to native WebSocket
    connections, so the frontend passes the existing JWT as a query parameter.
    The token is still validated against the users table before the socket is
    accepted.
    """

    try:
        payload = decode_access_token(token)
    except JWTError:
        return False

    user_id = payload.get("sub")
    if not user_id:
        return False

    db = SessionLocal()
    try:
        return db.scalar(select(User.id).where(User.id == user_id)) is not None
    finally:
        db.close()


@router.websocket("/events")
async def stream_events(websocket: WebSocket, token: str = "") -> None:
    """Stream simulator events to authenticated dashboard clients."""

    if not token or not _token_belongs_to_user(token):
        await websocket.close(code=1008)
        return

    await event_connection_manager.connect(websocket)
    try:
        # The server owns event delivery. This receive loop simply keeps the
        # connection alive and lets the browser close it naturally.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        event_connection_manager.disconnect(websocket)
