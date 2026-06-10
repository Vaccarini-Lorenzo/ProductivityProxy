from typing import Any

from proxy.api import RequestContext


def run(input: Any, context: RequestContext, params: dict[str, Any]) -> Any:
    context.event_log.append({
        "type": "notification",
        "title": str(params["title"]),
        "body": str(params["body"]),
    })
    return input
