from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.domain.enums import AssetStatus, AssetType, EventType, IncidentStatus, Severity


class SiteRead(BaseModel):
    """Site summary displayed in the global app header."""

    id: str
    name: str
    code: str
    region: str
    description: str


class AssetRead(BaseModel):
    """Asset card/table shape used by dashboard and future asset pages."""

    id: str
    name: str
    call_sign: str
    asset_type: AssetType
    status: AssetStatus
    zone: str
    latitude: float
    longitude: float
    battery_level: int
    last_seen_at: datetime
    metadata: dict[str, Any]


class EventRead(BaseModel):
    """Recent event shape that powers the audit-friendly event stream."""

    id: str
    asset_id: Optional[str]
    asset_name: Optional[str]
    event_type: EventType
    severity: Severity
    source: str
    zone: str
    message: str
    occurred_at: datetime
    metadata: dict[str, Any]


class IncidentRead(BaseModel):
    """Incident summary shape for the dashboard active-incident panel."""

    id: str
    title: str
    summary: str
    severity: Severity
    status: IncidentStatus
    explanation: str
    created_at: datetime
    updated_at: datetime
    related_event_ids: list[str]


class HourlyEventBucket(BaseModel):
    """Event count for a single hour bucket in the 24-hour activity chart."""

    hour: int   # 0-23 (UTC hour)
    count: int


class EventActivityRead(BaseModel):
    """24-hour event volume breakdown for the dashboard sparkline chart.

    Bucketing is done in Python from a single query so the endpoint works
    identically against SQLite (local dev) and PostgreSQL (Docker Compose).
    """

    buckets: list[HourlyEventBucket]
    total_24h: int
    peak_hour: int


class DashboardMetrics(BaseModel):
    """Aggregated counts that make the first dashboard screen feel alive."""

    active_incidents: int
    critical_events_today: int
    assets_monitored: int
    assets_in_alert: int
    system_health_percent: int


class DashboardOverview(BaseModel):
    """Single Phase 1 endpoint response that hydrates the main app shell."""

    site: SiteRead
    metrics: DashboardMetrics
    assets: list[AssetRead]
    incidents: list[IncidentRead]
    recent_events: list[EventRead]
