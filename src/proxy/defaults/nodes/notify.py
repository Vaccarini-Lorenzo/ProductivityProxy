def run(input, context, params):
    context.event_log.append({
        "type": "notification",
        "title": str(params["title"]),
        "body": str(params["body"]),
    })
    return input
