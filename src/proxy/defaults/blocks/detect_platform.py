def run(context, params):
    host = context.flow.request.pretty_host.lower().strip(".")
    suffixes = params.get("hostSuffixes", [])
    platform = params.get("platform", "unknown")

    if any(host == suffix or host.endswith("." + suffix) for suffix in suffixes):
        return {"output": "match", "data": {"platform": platform}}
    return {"output": "no_match"}
