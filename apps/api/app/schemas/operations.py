from pydantic import BaseModel

from app.schemas.dashboard import AssetRead, EventRead, IncidentRead


class PaginationMeta(BaseModel):
    """Pagination metadata returned with searchable history endpoints."""

    page: int
    page_size: int
    total: int
    total_pages: int


class EventHistoryPage(BaseModel):
    """Paginated event-history response used by the Phase 2 Events page."""

    items: list[EventRead]
    pagination: PaginationMeta


class IncidentListItem(IncidentRead):
    """Incident summary with enough context for list and split-panel views."""

    affected_assets: list[str]
    related_event_count: int


class IncidentDetail(IncidentListItem):
    """Full incident detail including timeline and affected asset records."""

    related_events: list[EventRead]
    affected_asset_details: list[AssetRead]


class AssetDetail(AssetRead):
    """Asset detail drawer response with recent telemetry and incident context."""

    recent_events: list[EventRead]
    related_incidents: list[IncidentListItem]
