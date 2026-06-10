from typing import Any

from proxy.api import RequestContext


def run(input: Any, context: RequestContext, params: dict[str, Any]) -> Any:
    data = dict(input) if isinstance(input, dict) else {}
    platform = params["platform"]
    idle_seconds = int(params["idleSeconds"])
    usage = context.state.track_usage(platform, idle_seconds, context.now())
    context.event_log.append({"type": "usage_tracked", **usage})
    data["usage"] = usage
    return data
