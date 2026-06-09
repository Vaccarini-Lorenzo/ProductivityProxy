def run(context, params):
    flow = context.flow
    host = flow.request.pretty_host.lower().strip(".")
    suffixes = params.get("hostSuffixes", [])
    markers = [marker.lower() for marker in params.get("markers", [])]

    if not any(host == suffix or host.endswith("." + suffix) for suffix in suffixes):
        return {"output": "no_match"}

    haystack = "\n".join([
        getattr(flow.request, "pretty_url", ""),
        getattr(flow.request, "path", ""),
        flow.request.headers.get("referer", ""),
        request_text(flow),
    ]).lower()

    if any(marker in haystack for marker in markers):
        return {"output": "match", "data": {"platform": "youtube", "kind": "shorts"}}
    return {"output": "no_match"}


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
