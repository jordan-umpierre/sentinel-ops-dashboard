"""
Incident summary provider unit tests.

The summary service is tested as a pure unit (no HTTP, no DB) by constructing
the context dataclass directly. This validates the provider contract —
specifically that the fallback always returns all required fields in the correct
shape, so a missing API key never breaks the incident UI.

Testing the provider interface separately from the HTTP layer lets you explain
the abstraction design clearly: the route delegates to a provider,
the provider can be swapped, and the contract is verified here.
"""

from unittest.mock import MagicMock

from app.domain.enums import AssetStatus, AssetType, EventType, IncidentStatus, Severity
from app.services.incident_summary import (
    FallbackIncidentSummaryProvider,
    IncidentSummaryContext,
    get_incident_summary_provider,
)


def _make_mock_incident(
    title: str = "Test Incident",
    summary: str = "Summary text.",
    severity: Severity = Severity.HIGH,
    status: IncidentStatus = IncidentStatus.OPEN,
    explanation: str = "Explanation.",
) -> MagicMock:
    """Build a minimal mock Incident model for provider tests."""
    incident = MagicMock()
    incident.id = "test-incident-id"
    incident.title = title
    incident.summary = summary
    incident.severity = severity
    incident.status = status
    incident.explanation = explanation
    return incident


def _make_mock_event(
    event_type: EventType = EventType.ACCESS_DENIED,
    severity: Severity = Severity.HIGH,
    zone: str = "North Gate",
    source: str = "Access Control",
    message: str = "Badge denied.",
) -> MagicMock:
    event = MagicMock()
    event.event_type = event_type
    event.severity = severity
    event.zone = zone
    event.source = source
    event.message = message
    event.metadata_json = {}
    return event


def _make_mock_asset(name: str = "Gate 3", call_sign: str = "GATE-3") -> MagicMock:
    asset = MagicMock()
    asset.id = "test-asset-id"
    asset.name = name
    asset.call_sign = call_sign
    asset.asset_type = AssetType.GATEWAY
    asset.status = AssetStatus.ALERT
    asset.zone = "North Gate"
    return asset


class TestFallbackProvider:
    """Validate that the deterministic fallback always returns a usable summary."""

    def setup_method(self) -> None:
        self.provider = FallbackIncidentSummaryProvider()

    def test_generate_returns_all_required_fields(self) -> None:
        context = IncidentSummaryContext(
            incident=_make_mock_incident(),
            related_events=[_make_mock_event()],
            affected_assets=[_make_mock_asset()],
        )
        result = self.provider.generate(context)

        # Every field the UI renders must be present and the correct type.
        assert isinstance(result.summary, str) and result.summary
        assert isinstance(result.likely_cause, str) and result.likely_cause
        assert isinstance(result.affected_assets, list)
        assert isinstance(result.suggested_next_checks, list)
        assert result.provider == "deterministic-fallback"

    def test_affected_assets_include_real_names(self) -> None:
        asset = _make_mock_asset(name="Yard Sensor Alpha")
        context = IncidentSummaryContext(
            incident=_make_mock_incident(),
            related_events=[_make_mock_event()],
            affected_assets=[asset],
        )
        result = self.provider.generate(context)
        assert "Yard Sensor Alpha" in result.affected_assets

    def test_multiple_event_types_appear_in_summary(self) -> None:
        events = [
            _make_mock_event(event_type=EventType.ACCESS_DENIED),
            _make_mock_event(event_type=EventType.GEOFENCE_BREACH),
        ]
        context = IncidentSummaryContext(
            incident=_make_mock_incident(),
            related_events=events,
            affected_assets=[],
        )
        result = self.provider.generate(context)
        # The fallback joins event types into the summary string.
        assert "access_denied" in result.summary or "geofence_breach" in result.summary

    def test_no_events_falls_back_gracefully(self) -> None:
        context = IncidentSummaryContext(
            incident=_make_mock_incident(),
            related_events=[],
            affected_assets=[],
        )
        result = self.provider.generate(context)
        # Must not raise; affected_assets defaults to "Site systems".
        assert result.affected_assets == ["Site systems"]
        assert len(result.suggested_next_checks) >= 1

    def test_suggested_checks_are_non_empty_strings(self) -> None:
        context = IncidentSummaryContext(
            incident=_make_mock_incident(),
            related_events=[_make_mock_event()],
            affected_assets=[_make_mock_asset()],
        )
        result = self.provider.generate(context)
        for check in result.suggested_next_checks:
            assert isinstance(check, str) and check.strip()


class TestProviderSelection:
    def test_no_api_key_returns_fallback_provider(self, monkeypatch) -> None:
        """Without OPENAI_API_KEY, get_incident_summary_provider must return fallback.

        This is the most critical runtime contract: the app must remain fully
        functional without any external API key configured.
        """
        monkeypatch.setattr("app.core.config.settings.OPENAI_API_KEY", None)
        provider = get_incident_summary_provider()
        assert isinstance(provider, FallbackIncidentSummaryProvider)
