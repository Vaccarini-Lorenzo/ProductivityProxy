from datetime import datetime, timezone
from time import time
from typing import Any

from proxy.api import Context, Request


def run(input: Any, request: Request, context: Context, params: dict[str, Any]) -> Any:
    data = dict(input) if isinstance(input, dict) else {}
    try:
        usage = context.persistent_state.get("usage")
    except KeyError:
        usage = {}
    record = usage.get(str(params["platform"]), {})
    day = datetime.fromtimestamp(time(), timezone.utc).date().isoformat()
    used = float(record.get("daily_seconds", {}).get(day, 0.0))
    data["used"] = used
    data["over_limit"] = used >= float(params["seconds"])
    return data
