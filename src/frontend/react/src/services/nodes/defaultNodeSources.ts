const SOURCES: Record<string, string> = {
  "block_response.py": `try:
    from mitmproxy import http
except ModuleNotFoundError:
    http = None


def run(input, context, params):
    status = int(params["status"])
    message = str(params["message"])
    context.flow.response = make_response(
        status,
        message.encode("utf-8"),
        {"Content-Type": "text/plain; charset=utf-8"},
    )
    return input


def make_response(status, content, headers):
    if http is not None:
        return http.Response.make(status, content, headers)
    return SimpleResponse(status, content, headers)


class SimpleResponse:
    def __init__(self, status_code, content, headers):
        self.status_code = status_code
        self.content = content
        self.headers = headers
`,
  "track_time.py": `def run(input, context, params):
    data = dict(input) if isinstance(input, dict) else {}
    platform = params["platform"]
    idle_seconds = int(params["idleSeconds"])
    usage = context.state.track_usage(platform, idle_seconds, context.now())
    context.event_log.append({"type": "usage_tracked", **usage})
    data["usage"] = usage
    return data
`,
  "is_usage_over_limit.py": `def run(input, context, params):
    data = dict(input) if isinstance(input, dict) else {}
    used = context.state.usage_today(params["platform"], context.now())
    data["used"] = used
    data["over_limit"] = used >= float(params["seconds"])
    return data
`,
};

export function bundledNodeSource(path: string): string | undefined {
  return SOURCES[path.split(/[\\/]/).pop() ?? ""];
}
