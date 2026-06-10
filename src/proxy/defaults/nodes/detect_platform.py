from typing import Any

from proxy.api import Context, Request


def run(input: Any, request: Request, context: Context, params: dict[str, Any]) -> Any:
    data = dict(input) if isinstance(input, dict) else {}
    host = request.host.lower().strip(".")
    suffixes = params["hostSuffixes"]
    matched = any(host == suffix or host.endswith("." + suffix) for suffix in suffixes)

    data["match"] = matched
    if matched:
        data["platform"] = params["platform"]
    return data
