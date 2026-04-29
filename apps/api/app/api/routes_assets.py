from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.api.serializers import asset_to_schema, event_to_schema, incident_to_schema
from app.core.database import get_db_session
from app.domain.enums import AssetStatus, AssetType
from app.domain.models import Asset, Event, Incident, IncidentEvent, User
from app.schemas.dashboard import AssetRead
from app.schemas.operations import AssetDetail, IncidentListItem


router = APIRouter(tags=["assets"])


def _incident_list_item(incident: Incident) -> IncidentListItem:
    """Build the incident list shape used inside an asset detail panel."""

    base = incident_to_schema(incident)
    assets = {
        link.event.asset.name
        for link in incident.event_links
        if link.event and link.event.asset is not None
    }
    return IncidentListItem(
        **base.model_dump(),
        affected_assets=sorted(assets),
        related_event_count=len(incident.event_links),
    )


@router.get("", response_model=list[AssetRead])
def list_assets(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
    search: str = Query("", description="Search by asset name, call sign, or zone."),
    status_filter: Optional[AssetStatus] = Query(None, alias="status"),
    asset_type: Optional[AssetType] = None,
    sort: str = Query("name", pattern="^(name|status|battery|last_seen)$"),
) -> list[AssetRead]:
    """Return filterable assets for the Phase 2 asset operations table."""

    query = select(Asset)

    # Search is intentionally broad for operator ergonomics: the same box covers
    # human names, radio-style call signs, and facility zones.
    if search:
        pattern = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(Asset.name).like(pattern),
                func.lower(Asset.call_sign).like(pattern),
                func.lower(Asset.zone).like(pattern),
            )
        )

    if status_filter:
        query = query.where(Asset.status == status_filter)
    if asset_type:
        query = query.where(Asset.asset_type == asset_type)

    sort_columns = {
        "name": Asset.name,
        "status": Asset.status,
        "battery": Asset.battery_level,
        "last_seen": Asset.last_seen_at,
    }
    sort_column = sort_columns[sort]
    if sort in {"battery", "last_seen"}:
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(sort_column)

    return [asset_to_schema(asset) for asset in db.scalars(query).all()]


@router.get("/{asset_id}", response_model=AssetDetail)
def get_asset_detail(
    asset_id: str,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> AssetDetail:
    """Return an asset with recent events and incidents that mention it."""

    asset = db.scalar(select(Asset).where(Asset.id == asset_id))
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")

    recent_events = list(
        db.scalars(
            select(Event)
            .options(selectinload(Event.asset))
            .where(Event.asset_id == asset_id)
            .order_by(desc(Event.occurred_at))
            .limit(8)
        ).all()
    )

    # Incidents are discovered through the immutable event links, which keeps the
    # asset panel audit-friendly: an incident appears only when linked evidence
    # actually references this asset.
    related_incidents = list(
        db.scalars(
            select(Incident)
            .join(IncidentEvent, IncidentEvent.incident_id == Incident.id)
            .join(Event, Event.id == IncidentEvent.event_id)
            .options(
                selectinload(Incident.event_links)
                .selectinload(IncidentEvent.event)
                .selectinload(Event.asset)
            )
            .where(Event.asset_id == asset_id)
            .distinct()
            .order_by(desc(Incident.created_at))
        ).all()
    )

    base = asset_to_schema(asset)
    return AssetDetail(
        **base.model_dump(),
        recent_events=[event_to_schema(event) for event in recent_events],
        related_incidents=[_incident_list_item(incident) for incident in related_incidents],
    )
