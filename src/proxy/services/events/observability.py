from __future__ import annotations

import time
from pathlib import Path
from typing import Any

SCHEMA = "observability.v1"
SCOPE_KEY = "_observability_scope"


class CustomNodeLogger:
    def __init__(self, context):
        self.context = context

    def debug(self, message: str, **data: Any) -> None:
        self.event("custom_node_log", message, "debug", **data)

    def info(self, message: str, **data: Any) -> None:
        self.event("custom_node_log", message, "info", **data)

    def warning(self, message: str, **data: Any) -> None:
        self.event("custom_node_log", message, "warning", **data)

    def warn(self, message: str, **data: Any) -> None:
        self.warning(message, **data)

    def error(self, message: str, **data: Any) -> None:
        self.event("custom_node_log", message, "error", **data)

    def event(self, event_type: str, message: str, level: str = "info", **data: Any) -> None:
        details = dict(_scope_fields(self.context))
        if data:
            details["data"] = data
        _append(self.context.event_log, self.context, event_type, level, message, details, category="custom_node", source="custom_node")


def config_loaded(event_log, config_path: Path, config) -> None:
    active_mode = config.active_mode()
    policy_count = sum(len(mode.policies) for mode in config.modes)
    _append(event_log, None, "config_loaded", "info", "Proxy config loaded", {
        "configPath": str(config_path),
        "modeId": config.active_mode_id,
        "modeName": active_mode.name,
        "modeCount": len(config.modes),
        "policyCount": policy_count,
        "customNodeCount": len(config.custom_nodes),
    })


def config_rejected(event_log, config_path: Path, error: Exception) -> None:
    _append(event_log, None, "config_rejected", "error", "Proxy config rejected", {
        "configPath": str(config_path),
        "errorType": type(error).__name__,
        "error": str(error),
    })


def request_started(context) -> None:
    _append(context.event_log, context, "request_started", "debug", "Request evaluation started", {})


def request_finished(context, outcome: str) -> None:
    _append(context.event_log, context, "request_finished", "info", f"Request {outcome}", {
        "outcome": outcome,
        **_response_fields(context),
    })


def request_failed(context, error: Exception) -> None:
    _append(context.event_log, context, "request_failed", "error", "Request evaluation failed", {
        "errorType": type(error).__name__,
        "error": str(error),
        **_response_fields(context),
    })


def policy_started(context, policy) -> None:
    _append(context.event_log, context, "policy_started", "debug", f"Policy {policy.id} started", {
        "policyId": policy.id,
        "policyName": policy.name,
    })


def policy_finished(context, policy, reason: str) -> None:
    _append(context.event_log, context, "policy_finished", "debug", f"Policy {policy.id} finished", {
        "policyId": policy.id,
        "policyName": policy.name,
        "reason": reason,
        **_response_fields(context),
    })


def policy_error(context, policy, step, error: Exception) -> None:
    details: dict[str, Any] = {
        "policyId": policy.id,
        "policyName": policy.name,
        "errorType": type(error).__name__,
        "error": str(error),
    }
    if step is not None:
        details.update(_step_fields(step))
    _append(context.event_log, context, "policy_error", "error", f"Policy {policy.id} failed", details)


def policy_step(context, policy, step, output: str, route_output: str, next_step_id: str | None, duration_ms: float) -> None:
    _append(context.event_log, context, "policy_step", "debug", f"Step {step.id} returned {output}", {
        "policyId": policy.id,
        "policyName": policy.name,
        **_step_fields(step),
        "output": output,
        "routeOutput": route_output,
        "nextStepId": next_step_id,
        "durationMs": round(duration_ms, 3),
        **_response_fields(context),
    })


def _append(
    event_log,
    context,
    event_type: str,
    level: str,
    message: str,
    details: dict[str, Any],
    category: str = "observability",
    source: str = "python_proxy",
) -> None:
    event = {
        "schema": SCHEMA,
        "timestamp": _timestamp(context),
        "category": category,
        "source": source,
        "type": event_type,
        "level": level,
        "message": message,
        **details,
    }
    if context is not None:
        event.update(_context_fields(context))
    try:
        event_log.append(event)
    except Exception:
        pass


def _timestamp(context) -> float:
    if context is None:
        return time.time()
    return float(context.now())


def _context_fields(context) -> dict[str, Any]:
    config = getattr(context, "config", None)
    fields = {
        "requestId": context.request_id,
        **_request_fields(context),
    }
    if config is not None:
        fields["modeId"] = config.active_mode_id
    return fields


def _scope_fields(context) -> dict[str, Any]:
    data = getattr(context, "data", None) or {}
    scope = data.get(SCOPE_KEY, {})
    return dict(scope) if isinstance(scope, dict) else {}


def _request_fields(context) -> dict[str, Any]:
    request = getattr(getattr(context, "flow", None), "request", None)
    if request is None:
        return {}
    return _without_empty({
        "method": getattr(request, "method", None),
        "url": getattr(request, "pretty_url", getattr(request, "url", None)),
        "host": getattr(request, "pretty_host", None),
        "path": getattr(request, "path", None),
    })


def _response_fields(context) -> dict[str, Any]:
    response = getattr(getattr(context, "flow", None), "response", None)
    if response is None:
        return {"responseSet": False}
    return _without_empty({
        "responseSet": True,
        "responseStatus": getattr(response, "status_code", None),
    })


def _step_fields(step) -> dict[str, Any]:
    return {
        "stepId": step.id,
        "stepKind": step.kind,
        "stepType": step.type,
    }


def _without_empty(values: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in values.items() if value not in (None, "")}
