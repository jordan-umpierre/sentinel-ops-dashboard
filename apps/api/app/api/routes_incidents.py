from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.api.serializers import asset_to_schema, event_to_schema, incident_to_schema
from app.core.database import get_db_session
from app.domain.enums import IncidentStatus, Severity
from app.domain.models import Asset, Event, Incident, IncidentEvent, User
from app.schemas.ai import IncidentSummaryRead
from app.schemas.operations import IncidentDetail, IncidentListItem
from app.services.incident_summary import IncidentSummaryContext, get_incident_summary_provider


router = APIRouter(tags=["incidents"])


def _incident_query():
    """Return the eager-loading query shape all incident routes need."""

    return select(Incident).options(
        selectinload(Incident.event_links).selectinload(IncidentEvent.event).selectinload(Event.asset)
    )


def _affected_assets_for_incident(incident: Incident) -> list[Asset]:
    """Derive affected assets from linked events instead of duplicating state."""

    assets_by_id = {}
    for link in incident.event_links:
        event = link.event
        if event and event.asset:
            assets_by_id[event.asset.id] = event.asset
    return list(assets_by_id.values())


def _incident_list_item(incident: Incident) -> IncidentListItem:
    """Build list-row data with affected asset names and evidence count."""

    base = incident_to_schema(incident)
    return IncidentListItem(
        **base.model_dump(),
        affected_assets=sorted(asset.name for asset in _affected_assets_for_incident(incident)),
        related_event_count=len(incident.event_links),
    )


@router.get("", response_model=list[IncidentListItem])
def list_incidents(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
    search: str = Query("", description="Search incident title, summary, or explanation."),
    status_filter: Optional[IncidentStatus] = Query(None, alias="status"),
    severity: Optional[Severity] = None,
) -> list[IncidentListItem]:
    """Return searchable incidents for the Phase 2 triage workspace."""

    query = _incident_query()
    if search:
        pattern = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(Incident.title).like(pattern),
                func.lower(Incident.summary).like(pattern),
                func.lower(Incident.explanation).like(pattern),
            )
        )
    if status_filter:
        query = query.where(Incident.status == status_filter)
    if severity:
        query = query.where(Incident.severity == severity)

    incidents = db.scalars(query.order_by(desc(Incident.created_at))).all()
    return [_incident_list_item(incident) for incident in incidents]


@router.get("/{incident_id}", response_model=IncidentDetail)
def get_incident_detail(
    incident_id: str,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> IncidentDetail:
    """Return a full incident with timeline and explainability context."""

    incident = db.scalar(_incident_query().where(Incident.id == incident_id))
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")

    related_events = sorted(
        [link.event for link in incident.event_links if link.event],
        key=lambda event: event.occurred_at,
        reverse=True,
    )
    affected_assets = _affected_assets_for_incident(incident)
    base = _incident_list_item(incident)
    return IncidentDetail(
        **base.model_dump(),
        related_events=[event_to_schema(event) for event in related_events],
        affected_asset_details=[asset_to_schema(asset) for asset in affected_assets],
    )


@router.get("/{incident_id}/summary", response_model=IncidentSummaryRead)
def summarize_incident(
    incident_id: str,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> IncidentSummaryRead:
    """Generate or retrieve an operator-facing summary for an incident.

    Phase 1 exposes this as an API capability before the dedicated incident UI
    lands. The route pulls the incident, linked events, and affected assets, then
    delegates all AI-specific behavior to the provider interface.
    """

    incident = db.scalar(
        _incident_query().where(Incident.id == incident_id)
    )
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found.",
        )

    related_events = [link.event for link in incident.event_links if link.event]
    affected_assets = _affected_assets_for_incident(incident)

    provider = get_incident_summary_provider()
    return provider.generate(
        IncidentSummaryContext(
            incident=incident,
            related_events=related_events,
            affected_assets=affected_assets,
        )
    )
