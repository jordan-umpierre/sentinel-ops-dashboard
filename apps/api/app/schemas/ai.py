from pydantic import BaseModel


class IncidentSummaryRead(BaseModel):
    """AI-ready incident summary returned by the summary provider layer."""

    summary: str
    likely_cause: str
    affected_assets: list[str]
    suggested_next_checks: list[str]
    provider: str
