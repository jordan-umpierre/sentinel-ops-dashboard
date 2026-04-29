"""add operational indexes

Revision ID: 20260429_0001
Revises:
Create Date: 2026-04-29 00:00:00.000000
"""

from typing import Optional, Sequence

from alembic import op
from sqlalchemy import inspect


revision: str = "20260429_0001"
down_revision: Optional[str] = None
branch_labels: Optional[Sequence[str]] = None
depends_on: Optional[Sequence[str]] = None


INDEXES = [
    ("ix_assets_site_status", "assets", ["site_id", "status"]),
    ("ix_assets_type_status", "assets", ["asset_type", "status"]),
    ("ix_assets_zone", "assets", ["zone"]),
    ("ix_events_site_occurred_at", "events", ["site_id", "occurred_at"]),
    ("ix_events_asset_occurred_at", "events", ["asset_id", "occurred_at"]),
    ("ix_events_severity_occurred_at", "events", ["severity", "occurred_at"]),
    ("ix_events_type_occurred_at", "events", ["event_type", "occurred_at"]),
    ("ix_incidents_site_status", "incidents", ["site_id", "status"]),
    ("ix_incidents_status_created_at", "incidents", ["status", "created_at"]),
    ("ix_incidents_severity_created_at", "incidents", ["severity", "created_at"]),
    ("ix_incident_summary_cache_expires_at", "incident_summary_cache", ["expires_at"]),
]


def _index_names(table_name: str) -> set[str]:
    return {
        index["name"]
        for index in inspect(op.get_bind()).get_indexes(table_name)
        if index.get("name")
    }


def _table_names() -> set[str]:
    return set(inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    tables = _table_names()
    for name, table_name, columns in INDEXES:
        if table_name in tables and name not in _index_names(table_name):
            op.create_index(name, table_name, columns)


def downgrade() -> None:
    tables = _table_names()
    for name, table_name, _columns in reversed(INDEXES):
        if table_name in tables and name in _index_names(table_name):
            op.drop_index(name, table_name=table_name)
