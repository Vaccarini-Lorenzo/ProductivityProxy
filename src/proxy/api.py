"""Small public API for policy Python code.

Author code should import only these types for hints:

    from proxy.api import Context, Request

    def run(input: Any, request: Request, context: Context, params: dict[str, Any]) -> Any:
        context.log("custom_event", "ran node")
        return input
"""

from __future__ import annotations

from typing import Any

from proxy.services.events import observability

try:
    from mitmproxy import http
except ModuleNotFoundError:
    http = None


class Request:
    """Current HTTP request, with a few safe actions."""

    def __init__(self, runtime_context):
        self._runtime = runtime_context
        self._request = runtime_context.flow.request

    @property
    def method(self) -> str:
        return str(getattr(self._request, "method", ""))

    @property
    def url(self) -> str:
        return str(getattr(self._request, "pretty_url", getattr(self._request, "url", "")))

    @url.setter
    def url(self, value: str) -> None:
        self.redirect(value)

    @property
    def host(self) -> str:
        return str(getattr(self._request, "pretty_host", ""))

    @property
    def path(self) -> str:
        return str(getattr(self._request, "path", ""))

    @property
    def headers(self):
        return self._request.headers

    def text(self) -> str:
        get_text = getattr(self._request, "get_text", None)
        if callable(get_text):
            try:
                return get_text(strict=False)
            except Exception:
                return ""
        content = getattr(self._request, "content", b"")
        if isinstance(content, bytes):
            return content.decode("utf-8", errors="ignore")
        return str(content)

    def redirect(self, url: str) -> None:
        self._request.url = url
        if hasattr(self._request, "pretty_url"):
            self._request.pretty_url = url

    def block(self, status: int, message: str, headers: dict[str, str] | None = None) -> None:
        response_headers = headers or {"Content-Type": "text/plain; charset=utf-8"}
        self._runtime.flow.response = _make_response(status, message.encode("utf-8"), response_headers)


class SharedState:
    """Dict-like shared memory."""

    def __init__(self, data: dict[str, Any]):
        self._data = data

    def __getitem__(self, key: str) -> Any:
        return self._data[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self._data[key] = value

    def __contains__(self, key: str) -> bool:
        return key in self._data

    def get(self, key: str, default: Any = None) -> Any:
        return self._data.get(key, default)

    def setdefault(self, key: str, default: Any) -> Any:
        return self._data.setdefault(key, default)


class Context:
    """Shared helpers for node code."""

    def __init__(self, runtime_context):
        self._runtime = runtime_context
        self.state = SharedState(runtime_context.shared_state)

    def log(self, type: str, message: str, level: str = "info", **data: Any) -> None:
        observability.custom_log(self._runtime, type, message, level, **data)

    def notify(self, type: str, message: str, level: str = "info", **data: Any) -> None:
        observability.notification(self._runtime, type, message, level, **data)


class SimpleResponse:
    def __init__(self, status_code: int, content: bytes, headers: dict[str, str]):
        self.status_code = status_code
        self.content = content
        self.headers = headers


def _make_response(status: int, content: bytes, headers: dict[str, str]):
    if http is not None:
        return http.Response.make(status, content, headers)
    return SimpleResponse(status, content, headers)


__all__ = ["Context", "Request"]
