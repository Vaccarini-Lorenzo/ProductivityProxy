def run(input, context, params):
    data = dict(input) if isinstance(input, dict) else {}
    host = context.flow.request.pretty_host.lower().strip(".")
    suffixes = params["hostSuffixes"]
    matched = any(host == suffix or host.endswith("." + suffix) for suffix in suffixes)

    data["match"] = matched
    if matched:
        data["platform"] = params["platform"]
    return data
