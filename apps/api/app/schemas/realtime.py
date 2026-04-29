from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.dashboard import AssetRead, EventRead, IncidentRead


class LiveEventMessage(BaseModel):
    """Websocket payload emitted whenever the simulator persists an event."""

    message_type: str
    event: EventRead
    asset: AssetRead
    incident: Optional[IncidentRead] = None
    emitted_at: datetime
