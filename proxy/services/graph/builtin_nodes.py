from __future__ import annotations

from typing import Any

try:
    from mitmproxy import http
except ModuleNotFoundError:
    http = None

from proxy.models.graph.policy_graph import GraphNode
from proxy.models.runtime.result import NodeResult


class BuiltinNodeRunner:
    def run(self, node: GraphNode, context) -> NodeResult:
        handlers = {
            "start": self._start,
            "end": self._end,
            "if": self._if,
            "switch": self._switch,
            "block": self._block,
            "log": self._log,
            "track_time": self._track_time,
            "notify": self._notify,
            "redirect": self._redirect,
        }
        handler = handlers.get(node.type)
        if handler is None:
            raise ValueError(f"Unknown built-in node type: {node.type}")
        return handler(node, context)

    def _start(self, node: GraphNode, context) -> NodeResult:
        return NodeResult()

    def _end(self, node: GraphNode, context) -> NodeResult:
        return NodeResult(output="end")

    def _if(self, node: GraphNode, context) -> NodeResult:
        value = _get_path(context.data, str(node.params["key"]))
        expected = node.params.get("equals", True)
        return NodeResult(output="true" if value == expected else "false")

    def _switch(self, node: GraphNode, context) -> NodeResult:
        value = _get_path(context.data, str(node.params["key"]))
        cases = dict(node.params.get("cases", {}))
        return NodeResult(output=str(cases.get(str(value), node.params.get("defaultOutput", "default"))))

    def _block(self, node: GraphNode, context) -> NodeResult:
        status = int(node.params.get("status", 403))
        message = str(node.params.get("message", "Request blocked"))
        context.flow.response = _make_response(
            status,
            message.encode("utf-8"),
            {"Content-Type": "text/plain; charset=utf-8"},
        )
        return NodeResult(output="blocked")

    def _log(self, node: GraphNode, context) -> NodeResult:
        event = {
            "type": str(node.params.get("eventType", "log")),
            "message": str(node.params.get("message", "")),
            "url": getattr(context.flow.request, "pretty_url", ""),
        }
        context.event_log.append(event)
        return NodeResult()

    def _track_time(self, node: GraphNode, context) -> NodeResult:
        platform = str(node.params["platform"])
        idle_seconds = int(node.params.get("idleSeconds", 300))
        usage = context.state.track_usage(platform, idle_seconds, context.now())
        context.event_log.append({"type": "usage_tracked", **usage})
        return NodeResult(data={"usage": usage})

    def _notify(self, node: GraphNode, context) -> NodeResult:
        context.event_log.append(
            {
                "type": "notification",
                "title": str(node.params.get("title", "ProductivityProxy")),
                "body": str(node.params.get("body", "")),
            }
        )
        return NodeResult()

    def _redirect(self, node: GraphNode, context) -> NodeResult:
        url = str(node.params["url"])
        context.flow.request.url = url
        if hasattr(context.flow.request, "pretty_url"):
            context.flow.request.pretty_url = url
        return NodeResult(output="redirected")


def _make_response(status: int, content: bytes, headers: dict[str, str]):
    if http is not None:
        return http.Response.make(status, content, headers)
    return SimpleResponse(status, content, headers)


class SimpleResponse:
    def __init__(self, status_code: int, content: bytes, headers: dict[str, str]):
        self.status_code = status_code
        self.content = content
        self.headers = headers


def _get_path(data: dict[str, Any], path: str) -> Any:
    current: Any = data
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current
