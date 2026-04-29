import asyncio
import random
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import desc, select
from sqlalchemy.orm import selectinload

from app.api.serializers import asset_to_schema, event_to_schema, incident_to_schema
from app.core.config import settings
from app.core.database import SessionLocal
from app.domain.enums import AssetStatus, AssetType, EventType, IncidentStatus, Severity
from app.domain.models import Asset, Event, Incident, IncidentEvent, Site, utc_now
from app.schemas.realtime import LiveEventMessage
from app.services.realtime import EventConnectionManager


@dataclass(frozen=True)
class SimulatedEventDraft:
    """Template data used before a simulated event is persisted."""

    event_type: EventType
    severity: Severity
    source: str
    message: str
    metadata: dict


class EventSimulator:
    """Background simulator that turns seeded assets into a live event stream.

    The simulator is intentionally in-process for portfolio clarity: one FastAPI
    service owns ingestion, persistence, correlation, and websocket broadcast.
    That keeps Phase 3 easy to run while still showing the real systems concepts.
    """

    def __init__(self, broadcaster: EventConnectionManager) -> None:
        self.broadcaster = broadcaster
        self._task: Optional[asyncio.Task] = None
        self._running = False

    def start(self) -> None:
        """Start the simulator loop once during application startup."""

        if self._task is None:
            self._running = True
            self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        """Stop the simulator cleanly during application shutdown."""

        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run_loop(self) -> None:
        """Persist and broadcast events at a predictable demo cadence."""

        while self._running:
            await asyncio.sleep(settings.SIMULATOR_INTERVAL_SECONDS)
            payload = self._create_live_event()
            if payload:
                await self.broadcaster.broadcast(payload.model_dump(mode="json"))

    def _create_live_event(self) -> Optional[LiveEventMessage]:
        """Create one event, update asset state, and optionally correlate incident."""

        db = SessionLocal()
        try:
            site = db.scalar(select(Site).limit(1))
            assets = list(db.scalars(select(Asset).order_by(Asset.name)).all())
            if not site or not assets:
                return None

            asset = random.choice(assets)
            draft = _build_event_draft(asset)
            now = utc_now()
            asset.last_seen_at = now
            asset.battery_level = _next_battery_level(asset, draft)
            asset.status = _next_asset_status(asset, draft)

            event = Event(
                site_id=site.id,
                asset_id=asset.id,
                event_type=draft.event_type,
                severity=draft.severity,
                source=draft.source,
                zone=asset.zone,
                message=draft.message,
                latitude=asset.latitude,
                longitude=asset.longitude,
                metadata_json=draft.metadata,
                occurred_at=now,
            )
            db.add(event)
            db.flush()

            incident = _maybe_correlate_incident(db, site, asset, event)
            db.commit()

            event_for_payload = db.scalar(
                select(Event).options(selectinload(Event.asset)).where(Event.id == event.id)
            )
            incident_for_payload = None
            if incident:
                incident_for_payload = db.scalar(
                    select(Incident)
                    .options(selectinload(Incident.event_links))
                    .where(Incident.id == incident.id)
                )

            return LiveEventMessage(
                message_type="event.created",
                event=event_to_schema(event_for_payload),
                asset=asset_to_schema(asset),
                incident=incident_to_schema(incident_for_payload) if incident_for_payload else None,
                emitted_at=now,
            )
        finally:
            db.close()


def _build_event_draft(asset: Asset) -> SimulatedEventDraft:
    """Choose realistic event content based on asset type and current state."""

    if asset.asset_type == AssetType.GATEWAY:
        return random.choice(
            [
                SimulatedEventDraft(
                    event_type=EventType.ACCESS_DENIED,
                    severity=Severity.HIGH,
                    source="Access Control",
                    message=f"{asset.name} denied a badge credential after repeated attempts.",
                    metadata={"attempt_count": random.randint(2, 5), "reader": asset.call_sign},
                ),
                SimulatedEventDraft(
                    event_type=EventType.SENSOR_HEARTBEAT,
                    severity=Severity.INFO,
                    source="Access Control",
                    message=f"{asset.name} reported reader heartbeat and door position nominal.",
                    metadata={"reader_status": "online"},
                ),
            ]
        )

    if asset.asset_type == AssetType.VEHICLE:
        return random.choice(
            [
                SimulatedEventDraft(
                    event_type=EventType.ROUTE_DEVIATION,
                    severity=Severity.MEDIUM,
                    source="Vehicle Telematics",
                    message=f"{asset.name} deviated from the assigned yard route.",
                    metadata={"route": asset.metadata_json.get("route", "unassigned")},
                ),
                SimulatedEventDraft(
                    event_type=EventType.SENSOR_HEARTBEAT,
                    severity=Severity.INFO,
                    source="Vehicle Telematics",
                    message=f"{asset.name} reported nominal telemetry.",
                    metadata={"speed_mph": random.randint(3, 12)},
                ),
            ]
        )

    if asset.asset_type == AssetType.PERSONNEL:
        return random.choice(
            [
                SimulatedEventDraft(
                    event_type=EventType.GEOFENCE_BREACH,
                    severity=Severity.HIGH,
                    source="Personnel Tracker",
                    message=f"{asset.name} crossed a restricted boundary near {asset.zone}.",
                    metadata={"duration_seconds": random.randint(25, 140)},
                ),
                SimulatedEventDraft(
                    event_type=EventType.SENSOR_HEARTBEAT,
                    severity=Severity.LOW,
                    source="Personnel Tracker",
                    message=f"{asset.name} checked in from {asset.zone}.",
                    metadata={"check_in": True},
                ),
            ]
        )

    return random.choice(
        [
            SimulatedEventDraft(
                event_type=EventType.TEMPERATURE_THRESHOLD,
                severity=Severity.MEDIUM,
                source="Environmental Sensor",
                message=f"{asset.name} exceeded configured environmental threshold.",
                metadata={"current_f": random.randint(39, 48), "threshold_f": 38},
            ),
            SimulatedEventDraft(
                event_type=EventType.EQUIPMENT_OFFLINE,
                severity=Severity.MEDIUM,
                source="Sensor Mesh",
                message=f"{asset.name} missed heartbeat intervals.",
                metadata={"missed_heartbeats": random.randint(2, 4)},
            ),
            SimulatedEventDraft(
                event_type=EventType.SENSOR_HEARTBEAT,
                severity=Severity.INFO,
                source="Sensor Mesh",
                message=f"{asset.name} reported sensor heartbeat.",
                metadata={"signal_strength": "stable"},
            ),
        ]
    )


def _next_battery_level(asset: Asset, draft: SimulatedEventDraft) -> int:
    """Apply small battery drift so repeated events feel alive."""

    if draft.event_type == EventType.SENSOR_HEARTBEAT:
        return max(0, min(100, asset.battery_level - random.randint(0, 1)))
    return max(0, min(100, asset.battery_level - random.randint(1, 3)))


def _next_asset_status(asset: Asset, draft: SimulatedEventDraft) -> AssetStatus:
    """Translate new event severity into the asset state badges shown in the UI."""

    if draft.event_type == EventType.EQUIPMENT_OFFLINE or asset.battery_level <= 5:
        return AssetStatus.OFFLINE
    if draft.severity in {Severity.HIGH, Severity.CRITICAL}:
        return AssetStatus.ALERT
    if draft.severity == Severity.MEDIUM:
        return AssetStatus.WATCH
    return AssetStatus.NOMINAL if asset.status != AssetStatus.OFFLINE else AssetStatus.WATCH


def _maybe_correlate_incident(db, site: Site, asset: Asset, event: Event) -> Optional[Incident]:
    """Open or update an incident when a meaningful simulated signal appears."""

    if event.severity not in {Severity.HIGH, Severity.CRITICAL}:
        return None

    incident = db.scalar(
        select(Incident)
        .where(Incident.status != IncidentStatus.RESOLVED)
        .where(Incident.title == f"{asset.zone} live anomaly")
        .order_by(desc(Incident.created_at))
    )

    if incident:
        incident.updated_at = event.occurred_at
    else:
        incident = Incident(
            site_id=site.id,
            title=f"{asset.zone} live anomaly",
            summary=f"Live simulator correlated a high-severity {event.event_type.value} signal.",
            severity=event.severity,
            status=IncidentStatus.OPEN,
            explanation=(
                "The incident was opened because the realtime simulator persisted a high-severity "
                f"{event.event_type.value} event for {asset.name}."
            ),
            created_at=event.occurred_at,
            updated_at=event.occurred_at,
        )
        db.add(incident)
        db.flush()

    db.add(IncidentEvent(incident_id=incident.id, event_id=event.id))
    return incident
