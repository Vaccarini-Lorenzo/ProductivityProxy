def run(input, context, params):
    data = dict(input) if isinstance(input, dict) else {}
    flow = context.flow
    host = flow.request.pretty_host.lower().strip(".")
    suffixes = params["hostSuffixes"]
    markers = [marker.lower() for marker in params["markers"]]

    host_matches = any(host == suffix or host.endswith("." + suffix) for suffix in suffixes)
    data["match"] = False
    if not host_matches:
        return data

    haystack = "\n".join([
        getattr(flow.request, "pretty_url", ""),
        getattr(flow.request, "path", ""),
        flow.request.headers.get("referer", ""),
        request_text(flow),
    ]).lower()

    if any(marker in haystack for marker in markers):
        data["match"] = True
        data["platform"] = "youtube"
        data["kind"] = "shorts"
    return data


def request_text(flow):
    get_text = getattr(flow.request, "get_text", None)
    if callable(get_text):
        try:
            return get_text(strict=False)
        except Exception:
            return ""
    content = getattr(flow.request, "content", b"")
    if isinstance(content, bytes):
        return content.decode("utf-8", errors="ignore")
    return str(content)
