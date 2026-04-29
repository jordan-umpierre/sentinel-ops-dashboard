from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.database import get_db_session
from app.domain.models import Asset, Incident, User
from app.schemas.ai import IncidentSummaryRead
from app.services.incident_summary import IncidentSummaryContext, get_incident_summary_provider


router = APIRouter(tags=["incidents"])


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
        select(Incident)
        .options(selectinload(Incident.event_links))
        .where(Incident.id == incident_id)
    )
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found.",
        )

    related_events = [link.event for link in incident.event_links]
    affected_asset_ids = {event.asset_id for event in related_events if event.asset_id}
    affected_assets = []
    if affected_asset_ids:
        affected_assets = list(db.scalars(select(Asset).where(Asset.id.in_(affected_asset_ids))).all())

    provider = get_incident_summary_provider()
    return provider.generate(
        IncidentSummaryContext(
            incident=incident,
            related_events=related_events,
            affected_assets=affected_assets,
        )
    )
