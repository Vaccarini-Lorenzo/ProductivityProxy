from typing import Any

from proxy.api import RequestContext


def run(input: Any, context: RequestContext, params: dict[str, Any]) -> Any:
    data = dict(input) if isinstance(input, dict) else {}
    used = context.state.usage_today(params["platform"], context.now())
    data["used"] = used
    data["over_limit"] = used >= float(params["seconds"])
    return data
