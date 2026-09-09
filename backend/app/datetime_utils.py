"""Datetime Utilities.
Ensures datetimes are consistently stored and serialized in ISO-8601 UTC format with 'Z' suffix.
"""

from datetime import datetime, timezone
from typing import Annotated, Any
from pydantic import PlainSerializer


def utc_now() -> datetime:
    """Returns current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def ensure_utc_iso(dt: Any) -> str:
    """Serializes a datetime into an ISO-8601 string with explicit 'Z' UTC suffix."""
    if not dt:
        return ""
    if isinstance(dt, str):
        trimmed = dt.strip()
        if not trimmed.endswith("Z") and not ("+" in trimmed or ("-" in trimmed and len(trimmed) > 10)):
            return trimmed + "Z"
        return trimmed
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")
    return str(dt)


UTCDateTime = Annotated[datetime, PlainSerializer(ensure_utc_iso, return_type=str)]
