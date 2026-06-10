from typing import Any

from proxy.api import RequestContext


def run(input: Any, context: RequestContext, params: dict[str, Any]) -> Any:
    url = str(params["url"])
    context.flow.request.url = url
    if hasattr(context.flow.request, "pretty_url"):
        context.flow.request.pretty_url = url
    return input
