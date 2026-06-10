from typing import Any

from proxy.api import Context, Request


def run(input: Any, request: Request, context: Context, params: dict[str, Any]) -> Any:
    context.notify(str(params["title"]), str(params["body"]))
    return input
