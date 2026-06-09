def run(input, context, params):
    data = dict(input) if isinstance(input, dict) else {}
    used = context.state.usage_today(params["platform"], context.now())
    data["used"] = used
    data["over_limit"] = used >= float(params["seconds"])
    return data
