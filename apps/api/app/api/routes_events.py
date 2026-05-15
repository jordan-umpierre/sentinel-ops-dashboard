import csv
import io
import math
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.api.serializers import event_to_schema
from app.core.database import get_db_session
from app.domain.enums import EventType, Severity
from app.domain.models import Asset, Event, User, utc_now
from app.schemas.operations import EventHistoryPage, PaginationMeta


router = APIRouter(tags=["events"])


def _build_event_query(
    db: Session,
    search: str,
    asset_id: str,
    severity: Optional[Severity],
    event_type: Optional[EventType],
    since_hours: int,
):
    """Return a filtered SELECT query shared by the list and export endpoints.

    Factoring the filter logic into a helper avoids duplication and ensures the
    exported CSV always matches what the operator sees on the Event History page.
    """
    query = select(Event).outerjoin(Asset).options(selectinload(Event.asset))

    # A single search box is faster for demo use than separate text filters, but
    # structured filters below keep query behavior explicit and testable.
    if search:
        pattern = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(Event.message).like(pattern),
                func.lower(Event.source).like(pattern),
                func.lower(Event.zone).like(pattern),
                func.lower(Asset.name).like(pattern),
                func.lower(Asset.call_sign).like(pattern),
            )
        )
    if asset_id:
        query = query.where(Event.asset_id == asset_id)
    if severity:
        query = query.where(Event.severity == severity)
    if event_type:
        query = query.where(Event.event_type == event_type)
    if since_hours:
        # Time-window filtering lets operators quickly answer "what happened
        # during this shift?" without losing the full immutable event history.
        query = query.where(Event.occurred_at >= utc_now() - timedelta(hours=since_hours))

    return query


@router.get("", response_model=EventHistoryPage)
def list_events(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
    search: str = Query("", description="Search event message, source, zone, or asset."),
    asset_id: str = "",
    severity: Optional[Severity] = None,
    event_type: Optional[EventType] = None,
    since_hours: int = Query(0, ge=0, le=168),
    sort: str = Query("newest", pattern="^(newest|oldest)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
) -> EventHistoryPage:
    """Return searchable, paginated event history for operator auditability."""

    query = _build_event_query(db, search, asset_id, severity, event_type, since_hours)

    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0
    order_by = desc(Event.occurred_at) if sort == "newest" else asc(Event.occurred_at)
    events = list(
        db.scalars(query.order_by(order_by).offset((page - 1) * page_size).limit(page_size)).all()
    )

    return EventHistoryPage(
        items=[event_to_schema(event) for event in events],
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=max(1, math.ceil(total / page_size)),
        ),
    )


@router.get("/export")
def export_events_csv(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
    search: str = Query("", description="Search event message, source, zone, or asset."),
    asset_id: str = "",
    severity: Optional[Severity] = None,
    event_type: Optional[EventType] = None,
    since_hours: int = Query(0, ge=0, le=168),
    sort: str = Query("newest", pattern="^(newest|oldest)$"),
) -> StreamingResponse:
    """Stream a CSV download of filtered events for operator audit records.

    Accepts the same filter parameters as the paginated list endpoint so the
    operator always exports exactly what they see on screen. No page_size cap
    applies — the full matching result set is included in one file.

    CSV is built in memory via io.StringIO. For the demo data volume this is
    safe; a production version would stream rows directly from the DB cursor
    using a generator to avoid holding the full result set in RAM.
    """

    query = _build_event_query(db, search, asset_id, severity, event_type, since_hours)
    order_by = desc(Event.occurred_at) if sort == "newest" else asc(Event.occurred_at)
    events = list(db.scalars(query.order_by(order_by)).all())

    output = io.StringIO()
    writer = csv.writer(output)

    # Header row matches the column names the frontend displays so that an
    # operator can open the file and immediately recognize each field.
    writer.writerow(
        ["id", "occurred_at", "event_type", "severity", "source", "zone", "asset", "message"]
    )
    for event in events:
        writer.writerow(
            [
                event.id,
                event.occurred_at.isoformat(),
                event.event_type.value,
                event.severity.value,
                event.source,
                event.zone,
                event.asset.name if event.asset else "",
                event.message,
            ]
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sentinel-events.csv"},
    )
