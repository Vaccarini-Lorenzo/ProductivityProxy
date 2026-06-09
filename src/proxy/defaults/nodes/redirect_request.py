def run(input, context, params):
    url = str(params["url"])
    context.flow.request.url = url
    if hasattr(context.flow.request, "pretty_url"):
        context.flow.request.pretty_url = url
    return input
