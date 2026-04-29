from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class IncidentSummaryRead(BaseModel):
    """AI-ready incident summary returned by the summary provider layer.

    `cached_at` is None when the response is freshly generated and set to the
    original generation timestamp when served from the DB cache. The frontend
    uses this to show a "cached" badge and offer a refresh action to operators.
    """

    summary: str
    likely_cause: str
    affected_assets: list[str]
    suggested_next_checks: list[str]
    provider: str
    cached_at: Optional[datetime] = None
