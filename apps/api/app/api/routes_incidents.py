from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.api.serializers import asset_to_schema, event_to_schema, incident_to_schema
from app.core.config import settings
from app.core.database import get_db_session
from app.domain.enums import IncidentStatus, Severity, UserRole
from app.domain.models import (
    Asset,
    Event,
    Incident,
    IncidentEvent,
    IncidentSummaryCache,
    User,
    utc_now,
)
from app.schemas.ai import IncidentSummaryRead
from app.schemas.operations import IncidentDetail, IncidentListItem
from app.services.incident_summary import IncidentSummaryContext, get_incident_summary_provider


router = APIRouter(tags=["incidents"])


def _to_utc_aware(dt: datetime) -> datetime:
    """Ensure a datetime is timezone-aware.

    SQLite stores datetimes without timezone info, so values read back from the
    DB are naive. Coercing to UTC-aware lets us compare them with utc_now(),
    which is always aware. PostgreSQL is not affected — it returns aware values.
    """
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


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


def _delete_summary_cache(incident_id: str, db: Session) -> None:
    """Remove a cached summary so the next request regenerates from scratch.

    Called when a status change makes the cached prompt context stale — the
    status field appears in the OpenAI prompt payload, so an outdated cache
    would surface the pre-transition status label to operators.
    """
    cached = db.get(IncidentSummaryCache, incident_id)
    if cached:
        db.delete(cached)


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
    refresh: bool = Query(False, description="Force regeneration, bypassing the DB cache."),
) -> IncidentSummaryRead:
    """Return an AI-generated summary for an incident, with DB-level caching.

    Cache hit path (default): check for a non-expired IncidentSummaryCache row
    and return it immediately without calling the AI provider. The response
    includes `cached_at` so the frontend can show a staleness badge.

    Cache miss or ?refresh=true path: generate via the provider, upsert the
    cache row with a new TTL, and return a fresh summary (cached_at is None).

    Status changes invalidate the cache via the PATCH /status endpoint because
    status appears in the OpenAI prompt — a stale cache would show the wrong
    status label in the AI output.
    """

    incident = db.scalar(_incident_query().where(Incident.id == incident_id))
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")

    # Serve from cache when the entry exists and hasn't expired.
    if not refresh:
        cached = db.get(IncidentSummaryCache, incident_id)
        if cached and _to_utc_aware(cached.expires_at) > utc_now():
            return IncidentSummaryRead(
                summary=cached.summary,
                likely_cause=cached.likely_cause,
                affected_assets=cached.affected_assets_json,
                suggested_next_checks=cached.suggested_next_checks_json,
                provider=cached.provider,
                cached_at=_to_utc_aware(cached.generated_at),  # signals UI that this is a cache hit
            )

    # Generate a fresh summary from the AI provider (or deterministic fallback).
    related_events = [link.event for link in incident.event_links if link.event]
    affected_assets = _affected_assets_for_incident(incident)
    provider = get_incident_summary_provider()
    result = provider.generate(
        IncidentSummaryContext(
            incident=incident,
            related_events=related_events,
            affected_assets=affected_assets,
        )
    )

    # Upsert the cache row — update in place if it already exists so the primary
    # key stays stable across refreshes. This avoids a delete+insert race.
    existing = db.get(IncidentSummaryCache, incident_id)
    ttl = timedelta(minutes=settings.SUMMARY_CACHE_TTL_MINUTES)
    now = utc_now()
    if existing:
        existing.provider = result.provider
        existing.summary = result.summary
        existing.likely_cause = result.likely_cause
        existing.affected_assets_json = result.affected_assets
        existing.suggested_next_checks_json = result.suggested_next_checks
        existing.generated_at = now
        existing.expires_at = now + ttl
    else:
        db.add(
            IncidentSummaryCache(
                incident_id=incident_id,
                provider=result.provider,
                summary=result.summary,
                likely_cause=result.likely_cause,
                affected_assets_json=result.affected_assets,
                suggested_next_checks_json=result.suggested_next_checks,
                generated_at=now,
                expires_at=now + ttl,
            )
        )
    db.commit()

    # cached_at is None for fresh generations so the UI shows "live" state.
    return result


class IncidentStatusUpdate(BaseModel):
    """Request body for the incident status transition endpoint."""

    status: IncidentStatus


@router.patch("/{incident_id}/status", response_model=IncidentListItem)
def update_incident_status(
    incident_id: str,
    body: IncidentStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> IncidentListItem:
    """Transition an incident through its operator lifecycle states.

    Allowed transitions match the product model:
      open → acknowledged (operator takes ownership)
      acknowledged → resolved (operator closes the loop)
      any → open (reopen if circumstances change)

    Viewer accounts are read-only; operator and admin roles can update state.
    Tracking who can change status and why is a common system-design talking
    point — this endpoint demonstrates the backend enforcement side.

    The AI summary cache is invalidated on every status change because the
    status value appears in the OpenAI prompt payload — a cached summary that
    still says "open" after an operator acknowledges the incident would confuse
    anyone reading the AI output on the triage workspace.
    """

    # Enforce role-based write access — viewers observe but cannot mutate state.
    if current_user.role == UserRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewer accounts cannot update incident status.",
        )

    incident = db.scalar(_incident_query().where(Incident.id == incident_id))
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found.",
        )

    _ALLOWED_TRANSITIONS: dict[IncidentStatus, set[IncidentStatus]] = {
        IncidentStatus.OPEN: {IncidentStatus.ACKNOWLEDGED},
        IncidentStatus.ACKNOWLEDGED: {IncidentStatus.RESOLVED, IncidentStatus.OPEN},
        IncidentStatus.RESOLVED: {IncidentStatus.OPEN},
    }
    if body.status not in _ALLOWED_TRANSITIONS.get(incident.status, set()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot transition from '{incident.status.value}' to '{body.status.value}'.",
        )

    # Persist the new status and bump updated_at so the frontend query cache
    # correctly invalidates detail and list views after a mutation.
    incident.status = body.status
    incident.updated_at = utc_now()

    # Invalidate the AI summary cache so the next summary request generates a
    # fresh response that reflects the new status in the prompt context.
    _delete_summary_cache(incident_id, db)

    db.commit()
    db.refresh(incident)

    return _incident_list_item(incident)
