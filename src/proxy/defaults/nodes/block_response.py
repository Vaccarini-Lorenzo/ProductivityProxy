from typing import Any

from proxy.api import RequestContext

try:
    from mitmproxy import http
except ModuleNotFoundError:
    http = None


def run(input: Any, context: RequestContext, params: dict[str, Any]) -> Any:
    status = int(params["status"])
    message = str(params["message"])
    context.flow.response = make_response(
        status,
        message.encode("utf-8"),
        {"Content-Type": "text/plain; charset=utf-8"},
    )
    return input


def make_response(status, content, headers):
    if http is not None:
        return http.Response.make(status, content, headers)
    return SimpleResponse(status, content, headers)


class SimpleResponse:
    def __init__(self, status_code, content, headers):
        self.status_code = status_code
        self.content = content
        self.headers = headers
