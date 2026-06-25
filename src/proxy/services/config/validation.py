"""Single source of truth for config + custom-node validation.

Pure functions returning a list of structured issues (never raises on invalid
input). The proxy runtime (`AppConfig.from_dict`) and the desktop save path
(`validate_cli.py`) both call these so there is exactly one set of rules.

Issue shape:
    {
        "scope": "global" | "policy" | "node",
        "policyId": str | None,
        "nodeId": str | None,
        "stepIds": list[str],
        "message": str,
        "hint": str,
    }
"""

from __future__ import annotations

import ast
import json
from pathlib import Path
from typing import Any

from proxy.services.config.proxy_validation import validate_proxy

BUILTIN_NODE_TYPES = {"start", "end"}
OPERATOR_FUNCTIONS = {"if": "if_condition", "switch": "switch_condition"}
NODE_PARAM_SPECS: dict[str, Any] = json.loads(
    (Path(__file__).resolve().parents[2] / "defaults/node_params.json").read_text(encoding="utf-8")
)


def _issue(message: str, hint: str, *, scope: str = "global", policy_id: str | None = None,
           node_id: str | None = None, step_ids: list[str] | None = None) -> dict[str, Any]:
    return {
        "scope": scope,
        "policyId": policy_id,
        "nodeId": node_id,
        "stepIds": step_ids or [],
        "message": message,
        "hint": hint,
    }


def validate_config(raw: dict[str, Any]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    policies = raw.get("policies", []) or []
    modes = raw.get("modes", []) or []
    custom_nodes = raw.get("customNodes", []) or []

    issues += _duplicates([p.get("id") for p in policies], "policy")
    issues += _duplicates([m.get("id") for m in modes], "mode")
    issues += _duplicates([n.get("id") for n in custom_nodes], "custom node")

    custom_node_ids = {str(n.get("id")) for n in custom_nodes}
    for node in custom_nodes:
        path = str(node.get("path", ""))
        if path and not Path(path).is_absolute():
            issues.append(_issue(
                f"Custom node path must be absolute: {path}",
                "Re-save the node so the app stores its absolute path.",
                scope="node", node_id=str(node.get("id")),
            ))

    active_mode_id = raw.get("activeModeId")
    policy_ids = {str(p.get("id")) for p in policies}
    if not any(str(m.get("id")) == str(active_mode_id) for m in modes):
        issues.append(_issue(
            f"Unknown active mode: {active_mode_id}",
            "Pick an existing mode as the active one.",
        ))
    for mode in modes:
        for pid in mode.get("policyIds", []) or []:
            if str(pid) not in policy_ids:
                issues.append(_issue(
                    f"Mode {mode.get('id')} references unknown policy: {pid}",
                    "Remove the missing policy from the mode.",
                ))

    issues += validate_proxy(raw.get("proxy", {}), _issue)

    for policy in policies:
        issues += _validate_policy(policy, custom_node_ids)

    return issues


def validate_node_code(code: str) -> list[dict[str, Any]]:
    tree = _safe_parse(code)
    if tree is None:
        return [_issue(
            "Python syntax error in the node code.",
            "Fix the highlighted syntax before saving.",
            scope="node",
        )]
    if "run" not in _function_names(tree):
        return [_issue(
            "Custom node must define run(input, request, context, params).",
            "Add a top-level `def run(input, request, context, params):` function.",
            scope="node",
        )]
    return []


def _validate_policy(policy: dict[str, Any], custom_node_ids: set[str]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    pid = str(policy.get("id"))
    name = str(policy.get("name", pid))
    steps = policy.get("steps", []) or []
    edges = policy.get("edges", []) or []

    issues += _duplicates([s.get("id") for s in steps], "policy step", policy_id=pid)

    step_ids = {str(s.get("id")) for s in steps}
    for edge in edges:
        if str(edge.get("from")) not in step_ids:
            issues.append(_policy_issue(pid, f"Route from unknown step: {edge.get('from')}",
                                        "Delete the dangling connection."))
        if str(edge.get("to")) not in step_ids:
            issues.append(_policy_issue(pid, f"Route to unknown step: {edge.get('to')}",
                                        "Delete the dangling connection."))

    issues += _duplicate_routes(pid, edges)
    issues += _validate_step_types(pid, steps, custom_node_ids)
    issues += _validate_node_params(pid, steps)
    issues += _validate_inline_code(pid, steps)

    starts = [s for s in steps if s.get("kind") == "node" and s.get("type") == "start"]
    if len(starts) != 1:
        issues.append(_policy_issue(
            pid, f"Policy '{name}' must contain exactly one start node (found {len(starts)}).",
            "Add a single Start node as the entry point." if not starts else "Remove the extra Start nodes.",
        ))
        return issues

    issues += _validate_reachability(pid, name, steps, edges, str(starts[0].get("id")))
    return issues


def _validate_reachability(pid: str, name: str, steps: list[dict[str, Any]],
                           edges: list[dict[str, Any]], start_id: str) -> list[dict[str, Any]]:
    adjacency: dict[str, list[str]] = {}
    for edge in edges:
        adjacency.setdefault(str(edge.get("from")), []).append(str(edge.get("to")))

    reachable: set[str] = set()
    stack = [start_id]
    while stack:
        current = stack.pop()
        if current in reachable:
            continue
        reachable.add(current)
        stack.extend(target for target in adjacency.get(current, []) if target not in reachable)

    orphans = [str(s.get("id")) for s in steps if str(s.get("id")) not in reachable]
    if not orphans:
        return []

    start_has_route = bool(adjacency.get(start_id))
    hint = ("Start has no outgoing connection — connect it to the next step."
            if not start_has_route else "Connect these steps to the flow or delete them.")
    return [_policy_issue(
        pid,
        f"Policy '{name}' has {len(orphans)} step(s) not connected to Start: {', '.join(orphans)}.",
        hint, step_ids=orphans,
    )]


def _validate_step_types(pid: str, steps: list[dict[str, Any]],
                         custom_node_ids: set[str]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    for step in steps:
        kind = step.get("kind")
        step_type = str(step.get("type"))
        step_id = str(step.get("id"))
        if kind == "node":
            if step_type not in BUILTIN_NODE_TYPES and step_type not in custom_node_ids:
                issues.append(_policy_issue(pid, f"Unknown node type: {step_type}",
                                            "Register the node on the Nodes page or remove this step.",
                                            step_ids=[step_id]))
        elif kind == "operator":
            if step_type not in OPERATOR_FUNCTIONS:
                issues.append(_policy_issue(pid, f"Unknown operator type: {step_type}",
                                            "Use a supported operator (if or switch).",
                                            step_ids=[step_id]))
        else:
            issues.append(_policy_issue(pid, f"Unknown step kind: {kind}",
                                        "Remove this step.", step_ids=[step_id]))
    return issues


def _validate_node_params(pid: str, steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    for step in steps:
        if step.get("kind") != "node":
            continue
        step_type = str(step.get("type"))
        spec = NODE_PARAM_SPECS.get(step_type)
        if not spec:
            continue
        params = step.get("params") or {}
        step_id = str(step.get("id"))
        if not isinstance(params, dict):
            issues.append(_policy_issue(pid, f"Step '{step_id}' params must be an object.",
                                        "Reset this node's parameters.", step_ids=[step_id]))
            continue
        for name, param_spec in (spec.get("params") or {}).items():
            if name not in params:
                issues.append(_policy_issue(pid, f"Step '{step_id}' is missing param: {name}",
                                            "Open the node and fill in all required parameters.", step_ids=[step_id]))
            elif not _matches_param_type(params[name], str(param_spec.get("type", ""))):
                issues.append(_policy_issue(pid, f"Step '{step_id}' param '{name}' has the wrong type.",
                                            f"Expected {param_spec.get('type')}.", step_ids=[step_id]))
    return issues


def _matches_param_type(value: Any, expected: str) -> bool:
    if expected == "string":
        return isinstance(value, str)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    return True


def _validate_inline_code(pid: str, steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    for step in steps:
        step_id = str(step.get("id"))
        code = (step.get("params") or {}).get("code")
        if not isinstance(code, str) or not code.strip():
            continue
        if step.get("kind") == "node" and step.get("type") == "start":
            issues += _check_function(pid, step_id, code, "triggered_by")
        elif step.get("kind") == "operator":
            function = OPERATOR_FUNCTIONS.get(str(step.get("type")))
            if function:
                issues += _check_function(pid, step_id, code, function)
    return issues


def _check_function(pid: str, step_id: str, code: str, function: str) -> list[dict[str, Any]]:
    tree = _safe_parse(code)
    if tree is None:
        return [_policy_issue(pid, f"Python syntax error in step '{step_id}'.",
                              "Fix the Python code for this step.", step_ids=[step_id])]
    if function not in _function_names(tree):
        return [_policy_issue(pid, f"Step '{step_id}' must define {function}(...).",
                              f"Add a `def {function}(...)` function.", step_ids=[step_id])]
    return []


def _duplicate_routes(pid: str, edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for edge in edges:
        route = (str(edge.get("from")), str(edge.get("output", "next")))
        if route in seen:
            issues.append(_policy_issue(pid, f"Duplicate route: {route[0]} -> {route[1]}",
                                        "A step output can only connect to one target."))
        seen.add(route)
    return issues


def _duplicates(values: list[Any], label: str, policy_id: str | None = None) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    seen: set[str] = set()
    for value in values:
        key = str(value)
        if key in seen:
            issues.append(_issue(
                f"Duplicate {label}: {key}", "Give it a unique id.",
                scope="policy" if policy_id else "global", policy_id=policy_id,
            ))
        seen.add(key)
    return issues


def _policy_issue(pid: str, message: str, hint: str, step_ids: list[str] | None = None) -> dict[str, Any]:
    return _issue(message, hint, scope="policy", policy_id=pid, step_ids=step_ids)


def _safe_parse(code: str) -> ast.Module | None:
    try:
        return ast.parse(code)
    except SyntaxError:
        return None


def _function_names(tree: ast.Module) -> set[str]:
    return {node.name for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))}
