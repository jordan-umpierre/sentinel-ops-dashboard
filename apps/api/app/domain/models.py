from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import JSON, DateTime, Enum, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.domain.enums import AssetStatus, AssetType, EventType, IncidentStatus, Severity, UserRole


def generate_id() -> str:
    """Create readable string UUIDs for API responses and frontend keys."""

    return str(uuid4())


def utc_now() -> datetime:
    """Keep timestamps timezone-aware so event ordering is reliable."""

    return datetime.now(timezone.utc)


class User(Base):
    """Demo user account used for JWT authentication and role-aware UI."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Site(Base):
    """A monitored facility that groups assets, events, and incidents."""

    __tablename__ = "sites"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    region: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    assets: Mapped[list["Asset"]] = relationship(back_populates="site")
    events: Mapped[list["Event"]] = relationship(back_populates="site")
    incidents: Mapped[list["Incident"]] = relationship(back_populates="site")


class Asset(Base):
    """Personnel, vehicles, sensors, and gateways visible to operators."""

    __tablename__ = "assets"
    __table_args__ = (
        Index("ix_assets_site_status", "site_id", "status"),
        Index("ix_assets_type_status", "asset_type", "status"),
        Index("ix_assets_zone", "zone"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    call_sign: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    asset_type: Mapped[AssetType] = mapped_column(Enum(AssetType), nullable=False)
    status: Mapped[AssetStatus] = mapped_column(Enum(AssetStatus), nullable=False)
    zone: Mapped[str] = mapped_column(String(80), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    battery_level: Mapped[int] = mapped_column(default=100)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)

    site: Mapped["Site"] = relationship(back_populates="assets")
    events: Mapped[list["Event"]] = relationship(back_populates="asset")


class Event(Base):
    """Immutable operational observation from a system, person, or sensor.

    Events become the audit trail for alert explanations. Incidents can link to
    multiple events, which lets the UI show exactly why a situation escalated.
    """

    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_site_occurred_at", "site_id", "occurred_at"),
        Index("ix_events_asset_occurred_at", "asset_id", "occurred_at"),
        Index("ix_events_severity_occurred_at", "severity", "occurred_at"),
        Index("ix_events_type_occurred_at", "event_type", "occurred_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id"), nullable=False)
    asset_id: Mapped[Optional[str]] = mapped_column(ForeignKey("assets.id"), nullable=True)
    event_type: Mapped[EventType] = mapped_column(Enum(EventType), nullable=False)
    severity: Mapped[Severity] = mapped_column(Enum(Severity), nullable=False)
    source: Mapped[str] = mapped_column(String(120), nullable=False)
    zone: Mapped[str] = mapped_column(String(80), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)

    site: Mapped["Site"] = relationship(back_populates="events")
    asset: Mapped[Optional["Asset"]] = relationship(back_populates="events")
    incident_links: Mapped[list["IncidentEvent"]] = relationship(back_populates="event")


class Incident(Base):
    """Correlated operational issue that operators can triage and explain."""

    __tablename__ = "incidents"
    __table_args__ = (
        Index("ix_incidents_site_status", "site_id", "status"),
        Index("ix_incidents_status_created_at", "status", "created_at"),
        Index("ix_incidents_severity_created_at", "severity", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[Severity] = mapped_column(Enum(Severity), nullable=False)
    status: Mapped[IncidentStatus] = mapped_column(Enum(IncidentStatus), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    site: Mapped["Site"] = relationship(back_populates="incidents")
    event_links: Mapped[list["IncidentEvent"]] = relationship(back_populates="incident")


class IncidentEvent(Base):
    """Join table preserving which events contributed to an incident."""

    __tablename__ = "incident_events"

    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id"), primary_key=True)

    incident: Mapped["Incident"] = relationship(back_populates="event_links")
    event: Mapped["Event"] = relationship(back_populates="incident_links")


class IncidentSummaryCache(Base):
    """Persisted AI summary for an incident, valid until expires_at.

    Caching avoids re-calling OpenAI on every incident selection, which reduces
    latency and API cost for the demo. The cache is invalidated explicitly when
    the incident status changes because status appears in the prompt context and
    a stale label would mislead operators viewing the AI output.

    TTL is configurable via SUMMARY_CACHE_TTL_MINUTES (default 60 minutes) so
    it can be shortened for development or extended for stable demo environments.
    """

    __tablename__ = "incident_summary_cache"
    __table_args__ = (
        Index("ix_incident_summary_cache_expires_at", "expires_at"),
    )

    incident_id: Mapped[str] = mapped_column(
        ForeignKey("incidents.id"), primary_key=True
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    likely_cause: Mapped[str] = mapped_column(Text, nullable=False)
    # JSON columns store Python lists directly; SQLAlchemy handles serialization.
    affected_assets_json: Mapped[list] = mapped_column(JSON, nullable=False)
    suggested_next_checks_json: Mapped[list] = mapped_column(JSON, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
