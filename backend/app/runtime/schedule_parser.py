from datetime import datetime
import re
from typing import TypedDict


class ParsedSchedule(TypedDict, total=False):
    type: str  # "schedule" | "onetime"
    interval: int
    unit: str  # "hour" | "day" | "week" | "month"
    time: str  # "HH:mm"
    date: str  # "YYYY-MM-DD"


def parse_schedule_string(schedule_str: str | None) -> ParsedSchedule | None:
    """Parse the schedule format transmitted by the frontend workbench into structured parameters."""
    if not schedule_str:
        return None

    schedule_str = schedule_str.strip()

    # Recurring pattern: Every <interval> <unit>[s] at <HH:mm>
    # Examples: "Every 1 day at 09:00", "Every 2 hours at 14:30"
    recur_pattern = r"^Every\s+(?P<interval>\d+)\s+(?P<unit>hour|day|week|month)s?\s+at\s+(?P<time>\d{1,2}:\d{2})$"
    m_recur = re.match(recur_pattern, schedule_str, re.IGNORECASE)
    if m_recur:
        return {
            "type": "schedule",
            "interval": int(m_recur.group("interval")),
            "unit": m_recur.group("unit").lower(),
            "time": m_recur.group("time"),
        }

    # One-time pattern: Once on <YYYY-MM-DD> at <HH:mm>
    # Example: "Once on 2026-09-05 at 09:00"
    onetime_pattern = r"^Once on\s+(?P<date>\d{4}-\d{2}-\d{2})\s+at\s+(?P<time>\d{1,2}:\d{2})$"
    m_one = re.match(onetime_pattern, schedule_str, re.IGNORECASE)
    if m_one:
        return {
            "type": "onetime",
            "date": m_one.group("date"),
            "time": m_one.group("time"),
        }

    return None


def is_agent_due(schedule_str: str | None, last_run: datetime | None = None, now: datetime | None = None) -> bool:
    """Evaluate whether an agent is due for execution based on its schedule."""
    parsed = parse_schedule_string(schedule_str)
    if not parsed:
        return False

    current_dt = now or datetime.now()

    if parsed.get("type") == "onetime":
        target_str = f"{parsed.get('date')} {parsed.get('time')}"
        try:
            target_dt = datetime.strptime(target_str, "%Y-%m-%d %H:%M")
            return current_dt >= target_dt and last_run is None
        except ValueError:
            return False

    if parsed.get("type") == "schedule":
        try:
            target_hour, target_minute = map(int, str(parsed.get("time", "00:00")).split(":"))
        except ValueError:
            return False

        if last_run is None:
            return (current_dt.hour, current_dt.minute) >= (target_hour, target_minute)

        elapsed = current_dt - last_run
        unit = parsed.get("unit", "day")
        interval = parsed.get("interval", 1)

        if unit == "hour":
            return elapsed.total_seconds() >= interval * 3600
        elif unit == "day":
            return elapsed.total_seconds() >= interval * 86400 and (current_dt.hour, current_dt.minute) >= (target_hour, target_minute)
        elif unit == "week":
            return elapsed.total_seconds() >= interval * 7 * 86400 and (current_dt.hour, current_dt.minute) >= (target_hour, target_minute)
        elif unit == "month":
            return elapsed.total_seconds() >= interval * 30 * 86400 and (current_dt.hour, current_dt.minute) >= (target_hour, target_minute)

    return False
