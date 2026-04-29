from datetime import timedelta

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.domain.enums import AssetStatus, AssetType, EventType, IncidentStatus, Severity, UserRole
from app.domain.models import Asset, Event, Incident, IncidentEvent, Site, User, utc_now


DEMO_PASSWORD = "sentinel123"


def seed_demo_data() -> None:
    """Insert deterministic demo data if the database is empty.

    This keeps Phase 1 instantly demoable: a reviewer can run the stack, log in,
    and see believable operational state without manually creating records.
    """

    db = SessionLocal()
    try:
        existing_site = db.scalar(select(Site).limit(1))
        if existing_site:
            return

        site = Site(
            name="Northstar Secure Logistics Hub",
            code="NSH-01",
            region="Midwest Corridor",
            description=(
                "A simulated high-security logistics facility with controlled gates, "
                "restricted yards, mobile patrols, and environmental sensors."
            ),
        )
        db.add(site)
        db.flush()

        # Seed users represent the three roles named in the brief. They share one
        # memorable demo password so the portfolio demo is easy to narrate.
        users = [
            User(
                email="admin@sentinel.dev",
                full_name="Avery Chen",
                role=UserRole.ADMIN,
                hashed_password=hash_password(DEMO_PASSWORD),
            ),
            User(
                email="operator@sentinel.dev",
                full_name="Jordan Lee",
                role=UserRole.OPERATOR,
                hashed_password=hash_password(DEMO_PASSWORD),
            ),
            User(
                email="viewer@sentinel.dev",
                full_name="Morgan Patel",
                role=UserRole.VIEWER,
                hashed_password=hash_password(DEMO_PASSWORD),
            ),
        ]
        db.add_all(users)

        now = utc_now()
        assets = [
            Asset(
                site_id=site.id,
                name="Patrol Team Alpha",
                call_sign="ALPHA-1",
                asset_type=AssetType.PERSONNEL,
                status=AssetStatus.WATCH,
                zone="Perimeter West",
                latitude=41.8811,
                longitude=-87.6311,
                battery_level=76,
                last_seen_at=now - timedelta(minutes=2),
                metadata_json={"team_size": 2, "assignment": "perimeter sweep"},
            ),
            Asset(
                site_id=site.id,
                name="Gate 3 Access Controller",
                call_sign="GATE-3",
                asset_type=AssetType.GATEWAY,
                status=AssetStatus.ALERT,
                zone="North Gate",
                latitude=41.8844,
                longitude=-87.6292,
                battery_level=100,
                last_seen_at=now - timedelta(minutes=1),
                metadata_json={"firmware": "2.8.1", "reader_status": "degraded"},
            ),
            Asset(
                site_id=site.id,
                name="Yard Mule 14",
                call_sign="VEH-14",
                asset_type=AssetType.VEHICLE,
                status=AssetStatus.NOMINAL,
                zone="Loading Yard",
                latitude=41.8794,
                longitude=-87.6338,
                battery_level=64,
                last_seen_at=now - timedelta(minutes=4),
                metadata_json={"route": "dock-loop", "operator": "C. Rivera"},
            ),
            Asset(
                site_id=site.id,
                name="Cold Storage Temperature Sensor",
                call_sign="TEMP-C2",
                asset_type=AssetType.SENSOR,
                status=AssetStatus.ALERT,
                zone="Cold Storage",
                latitude=41.8803,
                longitude=-87.6271,
                battery_level=42,
                last_seen_at=now - timedelta(minutes=3),
                metadata_json={"threshold_f": 38, "current_f": 44},
            ),
            Asset(
                site_id=site.id,
                name="Roofline Motion Sensor",
                call_sign="MOTION-R7",
                asset_type=AssetType.SENSOR,
                status=AssetStatus.OFFLINE,
                zone="Roofline East",
                latitude=41.8827,
                longitude=-87.6267,
                battery_level=9,
                last_seen_at=now - timedelta(minutes=18),
                metadata_json={"last_signal_strength": "weak"},
            ),
        ]
        db.add_all(assets)
        db.flush()

        events = [
            Event(
                site_id=site.id,
                asset_id=assets[1].id,
                event_type=EventType.ACCESS_DENIED,
                severity=Severity.HIGH,
                source="Access Control",
                zone="North Gate",
                message="Three denied badge attempts detected at Gate 3 within five minutes.",
                latitude=assets[1].latitude,
                longitude=assets[1].longitude,
                metadata_json={"badge_id": "TEMP-8841", "attempt_count": 3},
                occurred_at=now - timedelta(minutes=8),
            ),
            Event(
                site_id=site.id,
                asset_id=assets[0].id,
                event_type=EventType.GEOFENCE_BREACH,
                severity=Severity.HIGH,
                source="Personnel Tracker",
                zone="Perimeter West",
                message="Patrol Team Alpha crossed into a restricted vehicle lane during active loading.",
                latitude=assets[0].latitude,
                longitude=assets[0].longitude,
                metadata_json={"restricted_zone": "VL-2", "duration_seconds": 91},
                occurred_at=now - timedelta(minutes=6),
            ),
            Event(
                site_id=site.id,
                asset_id=assets[3].id,
                event_type=EventType.TEMPERATURE_THRESHOLD,
                severity=Severity.MEDIUM,
                source="Environmental Sensor",
                zone="Cold Storage",
                message="Cold storage temperature exceeded threshold for four consecutive readings.",
                latitude=assets[3].latitude,
                longitude=assets[3].longitude,
                metadata_json={"current_f": 44, "threshold_f": 38, "reading_count": 4},
                occurred_at=now - timedelta(minutes=5),
            ),
            Event(
                site_id=site.id,
                asset_id=assets[4].id,
                event_type=EventType.EQUIPMENT_OFFLINE,
                severity=Severity.MEDIUM,
                source="Sensor Mesh",
                zone="Roofline East",
                message="Roofline Motion Sensor missed three heartbeat intervals.",
                latitude=assets[4].latitude,
                longitude=assets[4].longitude,
                metadata_json={"missed_heartbeats": 3, "battery_level": 9},
                occurred_at=now - timedelta(minutes=4),
            ),
            Event(
                site_id=site.id,
                asset_id=assets[2].id,
                event_type=EventType.SENSOR_HEARTBEAT,
                severity=Severity.INFO,
                source="Vehicle Telematics",
                zone="Loading Yard",
                message="Yard Mule 14 reported nominal telemetry and route adherence.",
                latitude=assets[2].latitude,
                longitude=assets[2].longitude,
                metadata_json={"speed_mph": 7, "route": "dock-loop"},
                occurred_at=now - timedelta(minutes=1),
            ),
        ]
        db.add_all(events)
        db.flush()

        incident = Incident(
            site_id=site.id,
            title="North Gate access anomaly with perimeter exposure",
            summary=(
                "Repeated denied badge attempts at Gate 3 coincided with Patrol Team Alpha "
                "entering a restricted vehicle lane."
            ),
            severity=Severity.HIGH,
            status=IncidentStatus.OPEN,
            explanation=(
                "The incident was opened because access control recorded multiple failed "
                "badge attempts while a nearby personnel tracker reported a restricted-zone breach."
            ),
            created_at=now - timedelta(minutes=7),
            updated_at=now - timedelta(minutes=3),
        )
        db.add(incident)
        db.flush()
        db.add_all(
            [
                IncidentEvent(incident_id=incident.id, event_id=events[0].id),
                IncidentEvent(incident_id=incident.id, event_id=events[1].id),
            ]
        )

        db.commit()
    finally:
        db.close()
