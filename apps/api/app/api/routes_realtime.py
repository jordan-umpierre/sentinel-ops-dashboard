import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.domain.models import User
from app.services.realtime import event_connection_manager


router = APIRouter(tags=["realtime"])

_AUTH_TIMEOUT_SECONDS = 5
logger = logging.getLogger("sentinel.realtime")


def _resolve_user_from_token(token: str) -> bool:
    """Validate the JWT and confirm the user still exists in the database."""

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
async def stream_events(websocket: WebSocket) -> None:
    """Stream simulator events to authenticated dashboard clients.

    Authentication uses a first-frame handshake so the bearer token is never
    written to web server access logs or browser history. The client must send
    {"type": "auth", "token": "<JWT>"} within 5 s of opening the connection;
    the server closes with code 1008 if the frame is missing or invalid.
    """

    await websocket.accept()

    try:
        raw = await asyncio.wait_for(
            websocket.receive_text(), timeout=_AUTH_TIMEOUT_SECONDS
        )
        frame = json.loads(raw)
        token = frame.get("token", "") if isinstance(frame, dict) else ""
    except Exception:
        # Timeout, malformed JSON, or premature disconnect all collapse into a
        # single "invalid handshake" outcome — the policy-violation close is the
        # same in every case so the caller can't distinguish reasons.
        logger.warning("websocket.auth_frame_invalid", exc_info=True)
        await websocket.close(code=1008)
        return

    if not token or not _resolve_user_from_token(token):
        logger.warning("websocket.auth_rejected")
        await websocket.close(code=1008)
        return

    event_connection_manager.register(websocket)
    logger.info("websocket.connected")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        event_connection_manager.disconnect(websocket)
        logger.info("websocket.disconnected")
