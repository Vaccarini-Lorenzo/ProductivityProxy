def run(input, context, params):
    context.event_log.append({
        "type": str(params["eventType"]),
        "message": str(params["message"]),
        "url": getattr(context.flow.request, "pretty_url", ""),
    })
    return input
