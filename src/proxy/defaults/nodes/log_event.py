from typing import Any

from proxy.api import RequestContext


def run(input: Any, context: RequestContext, params: dict[str, Any]) -> Any:
    context.event_log.append({
        "type": str(params["eventType"]),
        "message": str(params["message"]),
        "url": getattr(context.flow.request, "pretty_url", ""),
    })
    return input
