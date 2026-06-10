from datetime import datetime, timezone
from time import time
from typing import Any

from proxy.api import Context, Request


def run(input: Any, request: Request, context: Context, params: dict[str, Any]) -> Any:
    data = dict(input) if isinstance(input, dict) else {}
    platform = str(params["platform"])
    try:
        usage = context.persistent_state.get("usage")
    except KeyError:
        usage = {}
    record = usage.setdefault(platform, {"total_seconds": 0.0, "daily_seconds": {}, "last_seen_at": None})
    now = time()
    day = datetime.fromtimestamp(now, timezone.utc).date().isoformat()
    daily = record.setdefault("daily_seconds", {})
    last_seen = record.get("last_seen_at")
    delta = 0.0
    event = "session_start"

    if last_seen is not None:
        elapsed = max(0.0, now - float(last_seen))
        if elapsed <= int(params["idleSeconds"]):
            delta = elapsed
            event = "activity"
            record["total_seconds"] = float(record.get("total_seconds", 0.0)) + delta
            daily[day] = float(daily.get(day, 0.0)) + delta

    record["last_seen_at"] = now
    result = {
        "platform": platform,
        "event": event,
        "delta_seconds": delta,
        "daily_seconds": float(daily.get(day, 0.0)),
        "total_seconds": float(record.get("total_seconds", 0.0)),
    }
    context.persistent_state.set("usage", usage)
    context.log("usage_tracked", "Usage tracked", **result)
    data["usage"] = result
    return data
