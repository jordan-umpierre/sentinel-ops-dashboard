import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Iterable

from openai import OpenAI

from app.core.config import settings
from app.domain.models import Asset, Event, Incident
from app.schemas.ai import IncidentSummaryRead


logger = logging.getLogger("sentinel.ai")


@dataclass(frozen=True)
class IncidentSummaryContext:
    """Structured context passed to any incident-summary implementation.

    The provider boundary keeps the rest of the backend independent from OpenAI.
    That makes the project easier to demo without a key and easier to extend if
    a future phase adds caching, evaluation, or a different model provider.
    """

    incident: Incident
    related_events: list[Event]
    affected_assets: list[Asset]


class IncidentSummaryProvider(ABC):
    """Common contract for AI-backed and deterministic summary providers."""

    @abstractmethod
    def generate(self, context: IncidentSummaryContext) -> IncidentSummaryRead:
        """Generate an operator-facing incident summary from incident context."""


class FallbackIncidentSummaryProvider(IncidentSummaryProvider):
    """Deterministic summary provider used when no API key is configured.

    The fallback preserves the demo experience, keeps tests stable, and gives
    operators a useful summary even when the AI dependency is unavailable.
    """

    provider_name = "deterministic-fallback"

    def generate(self, context: IncidentSummaryContext) -> IncidentSummaryRead:
        event_types = ", ".join(sorted({event.event_type.value for event in context.related_events}))
        affected_assets = _asset_names(context.affected_assets)
        top_zone = context.related_events[0].zone if context.related_events else "the monitored site"

        return IncidentSummaryRead(
            summary=(
                f"{context.incident.title}: {context.incident.summary} "
                f"Related signals include {event_types or 'operator-entered context'}."
            ),
            likely_cause=(
                "The incident appears to be driven by correlated operational signals "
                f"around {top_zone}, matching the configured explanation logic."
            ),
            affected_assets=affected_assets,
            suggested_next_checks=[
                "Confirm the latest position and status of each affected asset.",
                "Review the linked event timeline for escalation order and duplicate signals.",
                "Dispatch an operator check if the incident remains open after acknowledgement.",
            ],
            provider=self.provider_name,
        )


class OpenAIIncidentSummaryProvider(IncidentSummaryProvider):
    """OpenAI Chat Completions implementation for incident summaries.

    Uses JSON mode to guarantee parseable output, then validates the response
    before returning data to the route. Any API or parsing failure falls back to
    the deterministic provider so the application remains runnable without drama.

    The provider interface makes swapping models or adding caching trivial — a key
    talking point when explaining the AI layer during a technical interview.
    """

    provider_name = "openai"

    # System prompt instructs the model to return strictly structured JSON so the
    # response can be parsed without brittle regex or schema inference.
    _SYSTEM_PROMPT = (
        "You are an operational incident analyst for a secure logistics facility. "
        "Given a structured incident payload, return ONLY valid JSON with exactly these keys: "
        "summary (string), likely_cause (string), affected_assets (array of strings), "
        "suggested_next_checks (array of strings). "
        "Use concise, practical language appropriate for a live operational dashboard. "
        "Do not include any text outside the JSON object."
    )

    def __init__(self, fallback_provider: IncidentSummaryProvider) -> None:
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.fallback_provider = fallback_provider

    def generate(self, context: IncidentSummaryContext) -> IncidentSummaryRead:
        try:
            # response_format=json_object enforces valid JSON output without
            # custom parsing — cleaner than prompt-only JSON constraints.
            response = self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": self._SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": json.dumps(_context_to_prompt_payload(context)),
                    },
                ],
                max_tokens=500,
                temperature=0.3,  # low temperature keeps summaries consistent across demos
            )

            parsed = json.loads(response.choices[0].message.content or "{}")
            return IncidentSummaryRead(
                summary=str(parsed["summary"]),
                likely_cause=str(parsed["likely_cause"]),
                affected_assets=[str(item) for item in parsed["affected_assets"]],
                suggested_next_checks=[str(item) for item in parsed["suggested_next_checks"]],
                provider=self.provider_name,
            )
        except Exception:
            # Any API error, network timeout, or unexpected JSON shape gracefully
            # degrades to the deterministic provider rather than surfacing a 500.
            logger.warning("incident_summary.openai_fallback", exc_info=True)
            return self.fallback_provider.generate(context)


def get_incident_summary_provider() -> IncidentSummaryProvider:
    """Choose OpenAI when configured, otherwise use the deterministic fallback."""

    fallback_provider = FallbackIncidentSummaryProvider()
    if not settings.OPENAI_API_KEY:
        return fallback_provider
    return OpenAIIncidentSummaryProvider(fallback_provider=fallback_provider)


def _asset_names(assets: Iterable[Asset]) -> list[str]:
    """Normalize affected assets into readable names for API consumers."""

    names = [asset.name for asset in assets]
    return names or ["Site systems"]


def _context_to_prompt_payload(context: IncidentSummaryContext) -> dict:
    """Build the compact incident payload sent to OpenAI.

    Keeping the payload small reduces token cost while including enough signal
    for the model to produce a useful summary and next-step recommendations.
    """

    return {
        "incident": {
            "title": context.incident.title,
            "summary": context.incident.summary,
            "severity": context.incident.severity.value,
            "status": context.incident.status.value,
            "explanation": context.incident.explanation,
        },
        "affected_assets": [
            {
                "name": asset.name,
                "call_sign": asset.call_sign,
                "type": asset.asset_type.value,
                "status": asset.status.value,
                "zone": asset.zone,
            }
            for asset in context.affected_assets
        ],
        "related_events": [
            {
                "type": event.event_type.value,
                "severity": event.severity.value,
                "source": event.source,
                "zone": event.zone,
                "message": event.message,
                "metadata": event.metadata_json,
            }
            for event in context.related_events
        ],
    }
