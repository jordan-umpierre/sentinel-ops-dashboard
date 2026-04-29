from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.database import get_db_session
from app.domain.enums import AssetStatus, IncidentStatus, Severity
from app.domain.models import Asset, Event, Incident, Site, User
from app.schemas.dashboard import (
    AssetRead,
    DashboardMetrics,
    DashboardOverview,
    EventRead,
    IncidentRead,
    SiteRead,
)


router = APIRouter(tags=["dashboard"])


def _asset_to_schema(asset: Asset) -> AssetRead:
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


def _event_to_schema(event: Event) -> EventRead:
    """Attach optional asset context to recent events for richer feeds."""

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


def _incident_to_schema(incident: Incident) -> IncidentRead:
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


@router.get("/overview", response_model=DashboardOverview)
def get_dashboard_overview(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> DashboardOverview:
    """Return the initial operational snapshot for the dashboard.

    Phase 1 favors one coarse-grained endpoint so the frontend can hydrate fast
    and stay easy to demo. Later phases can split this into paginated asset,
    incident, and event-history endpoints as those screens become richer.
    """

    site = db.scalar(select(Site).limit(1))
    assets = list(db.scalars(select(Asset).order_by(Asset.name)).all())
    incidents = list(
        db.scalars(
            select(Incident)
            .options(selectinload(Incident.event_links))
            .order_by(desc(Incident.created_at))
        ).all()
    )
    events = list(
        db.scalars(
            select(Event)
            .options(selectinload(Event.asset))
            .order_by(desc(Event.occurred_at))
            .limit(12)
        ).all()
    )

    asset_status_counts = Counter(asset.status for asset in assets)
    metrics = DashboardMetrics(
        active_incidents=sum(
            1 for incident in incidents if incident.status != IncidentStatus.RESOLVED
        ),
        critical_events_today=sum(
            1 for event in events if event.severity in {Severity.HIGH, Severity.CRITICAL}
        ),
        assets_monitored=len(assets),
        assets_in_alert=asset_status_counts[AssetStatus.ALERT] + asset_status_counts[AssetStatus.OFFLINE],
        system_health_percent=86,
    )

    return DashboardOverview(
        site=SiteRead(
            id=site.id,
            name=site.name,
            code=site.code,
            region=site.region,
            description=site.description,
        ),
        metrics=metrics,
        assets=[_asset_to_schema(asset) for asset in assets],
        incidents=[_incident_to_schema(incident) for incident in incidents],
        recent_events=[_event_to_schema(event) for event in events],
    )
