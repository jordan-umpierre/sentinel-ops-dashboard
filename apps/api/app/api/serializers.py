"""Small serializer helpers shared by read-only API routes.

These functions keep endpoint code focused on query/filter behavior while the
field-level mapping from SQLAlchemy models to Pydantic contracts lives in one
place. That matters as Phase 2 adds multiple read surfaces for the same domain
entities.
"""

from app.domain.models import Asset, Event, Incident
from app.schemas.dashboard import AssetRead, EventRead, IncidentRead


def asset_to_schema(asset: Asset) -> AssetRead:
    """Map asset ORM fields into frontend-friendly JSON names."""

    return AssetRead(
        id=asset.id,
        name=asset.name,
        call_sign=asset.call_sign,
        asset_type=asset.asset_type,
        status=asset.status,
        zone=asset.zone,
        latitude=asset.latitude,
        longitude=asset.longitude,
        battery_level=asset.battery_level,
        last_seen_at=asset.last_seen_at,
        metadata=asset.metadata_json,
    )


def event_to_schema(event: Event) -> EventRead:
    """Attach optional asset context to an event for tables and timelines."""

    return EventRead(
        id=event.id,
        asset_id=event.asset_id,
        asset_name=event.asset.name if event.asset else None,
        event_type=event.event_type,
        severity=event.severity,
        source=event.source,
        zone=event.zone,
        message=event.message,
        occurred_at=event.occurred_at,
        metadata=event.metadata_json,
    )


def incident_to_schema(incident: Incident) -> IncidentRead:
    """Expose related event IDs so the UI can explain incident triggers."""

    return IncidentRead(
        id=incident.id,
        title=incident.title,
        summary=incident.summary,
        severity=incident.severity,
        status=incident.status,
        explanation=incident.explanation,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
        related_event_ids=[link.event_id for link in incident.event_links],
    )
