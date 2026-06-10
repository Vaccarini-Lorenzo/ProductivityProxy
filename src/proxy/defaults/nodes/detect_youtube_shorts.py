from typing import Any

from proxy.api import Context, Request


def run(input: Any, request: Request, context: Context, params: dict[str, Any]) -> Any:
    data = dict(input) if isinstance(input, dict) else {}
    host = request.host.lower().strip(".")
    suffixes = params["hostSuffixes"]
    markers = [marker.lower() for marker in params["markers"]]

    host_matches = any(host == suffix or host.endswith("." + suffix) for suffix in suffixes)
    data["match"] = False
    if not host_matches:
        return data

    haystack = "\n".join([
        request.url,
        request.path,
        request.headers.get("referer", ""),
        request.text(),
    ]).lower()

    if any(marker in haystack for marker in markers):
        data["match"] = True
        data["platform"] = "youtube"
        data["kind"] = "shorts"
    return data
