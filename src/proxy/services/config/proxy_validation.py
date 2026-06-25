from __future__ import annotations

from typing import Any, Callable

Issue = dict[str, Any]
IssueFactory = Callable[[str, str], Issue]

LOCAL_ROUTING_MODES = {"systemWide", "appSpecific"}


def validate_proxy(proxy: Any, issue: IssueFactory) -> list[Issue]:
    if not isinstance(proxy, dict):
        return [issue("Proxy settings must be an object.", "Reset the proxy settings.")]
    issues: list[Issue] = []
    mode = proxy.get("localRoutingMode", "systemWide")
    if mode not in LOCAL_ROUTING_MODES:
        issues.append(issue(
            f"Unknown local routing mode: {mode}",
            "Choose System-wide or App-specific routing.",
        ))
    targets = proxy.get("appCaptureTargets", [])
    if not isinstance(targets, list):
        return issues + [issue("App capture targets must be a list.", "Choose apps from Settings.")]
    invalid = [str(item) for item in targets if not _valid_capture_name(item)]
    if invalid:
        issues.append(issue(
            f"Invalid app capture target: {', '.join(invalid)}",
            "Use running app names from Settings. Commas and leading ! are not supported.",
        ))
    if mode == "appSpecific" and not targets:
        issues.append(issue(
            "App-specific routing needs at least one app.",
            "Select an app in Settings or switch back to System-wide.",
        ))
    return issues


def _valid_capture_name(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    name = value.strip()
    return bool(name) and "," not in name and not name.startswith("!")
