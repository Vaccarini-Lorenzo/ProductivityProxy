from typing import Any

from proxy.api import Context, Request


def run(input: Any, request: Request, context: Context, params: dict[str, Any]) -> Any:
    context.log(str(params["eventType"]), str(params["message"]), url=request.url)
    return input
