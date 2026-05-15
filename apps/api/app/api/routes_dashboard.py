from collections import Counter
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.api.serializers import asset_to_schema, event_to_schema, incident_to_schema
from app.core.database import get_db_session
from app.domain.enums import AssetStatus, IncidentStatus, Severity
from app.domain.models import Asset, Event, Incident, Site, User, utc_now
from app.schemas.dashboard import (
    DashboardMetrics,
    DashboardOverview,
    EventActivityRead,
    HourlyEventBucket,
    SiteRead,
)


router = APIRouter(tags=["dashboard"])


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
        system_health_percent=round(
            asset_status_counts[AssetStatus.NOMINAL] / max(len(assets), 1) * 100
        ),
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
        assets=[asset_to_schema(asset) for asset in assets],
        incidents=[incident_to_schema(incident) for incident in incidents],
        recent_events=[event_to_schema(event) for event in events],
    )


@router.get("/activity", response_model=EventActivityRead)
def get_event_activity(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> EventActivityRead:
    """Return a 24-hour hourly event volume breakdown for the dashboard sparkline.

    Bucketing is done in Python after a single date-filtered query so the
    implementation stays compatible with both SQLite (local dev) and PostgreSQL
    (Docker). This avoids db-specific
    date functions like date_trunc (Postgres) vs strftime (SQLite) at the cost
    of fetching more rows — acceptable at demo scale.
    """

    cutoff = utc_now() - timedelta(hours=24)
    events = list(
        db.scalars(
            select(Event.occurred_at).where(Event.occurred_at >= cutoff)
        ).all()
    )

    # Build a 24-slot histogram indexed by UTC hour (0–23).
    bucket_counts: dict[int, int] = {h: 0 for h in range(24)}
    for occurred_at in events:
        bucket_counts[occurred_at.hour] += 1

    buckets = [HourlyEventBucket(hour=h, count=bucket_counts[h]) for h in range(24)]
    total = len(events)
    peak_hour = max(bucket_counts, key=lambda h: bucket_counts[h]) if events else 0

    return EventActivityRead(buckets=buckets, total_24h=total, peak_hour=peak_hour)
