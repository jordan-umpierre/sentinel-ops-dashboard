import math
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.api.serializers import event_to_schema
from app.core.database import get_db_session
from app.domain.enums import EventType, Severity
from app.domain.models import Asset, Event, User
from app.schemas.operations import EventHistoryPage, PaginationMeta


router = APIRouter(tags=["events"])


@router.get("", response_model=EventHistoryPage)
def list_events(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
    search: str = Query("", description="Search event message, source, zone, or asset."),
    asset_id: str = "",
    severity: Optional[Severity] = None,
    event_type: Optional[EventType] = None,
    sort: str = Query("newest", pattern="^(newest|oldest)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
) -> EventHistoryPage:
    """Return searchable, paginated event history for operator auditability."""

    query = select(Event).outerjoin(Asset).options(selectinload(Event.asset))

    # A single search box is faster for demo use than separate text filters, but
    # structured filters below still show clean query handling for interviews.
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
