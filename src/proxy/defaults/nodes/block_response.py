from typing import Any

from proxy.api import Context, Request


def run(input: Any, request: Request, context: Context, params: dict[str, Any]) -> Any:
    request.block(int(params["status"]), str(params["message"]))
    return input
