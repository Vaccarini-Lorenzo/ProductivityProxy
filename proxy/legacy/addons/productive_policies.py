import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit

from mitmproxy import http


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value.strip()


def csv_env(name: str) -> list[str]:
    raw = require_env(name)
    values = [part.strip().lower() for part in raw.split(",") if part.strip()]
    if not values:
        raise RuntimeError(f"Environment variable {name} must contain at least one value")
    return values


STATE_PATH = Path(require_env("PRODUCTIVE_PROXY_STATE_PATH"))
EVENT_LOG_PATH = Path(require_env("PRODUCTIVE_PROXY_EVENT_LOG_PATH"))
REDDIT_IDLE_SECONDS = int(require_env("PRODUCTIVE_PROXY_REDDIT_IDLE_SECONDS"))
REDDIT_DAILY_LIMIT_SECONDS = int(require_env("PRODUCTIVE_PROXY_REDDIT_DAILY_LIMIT_SECONDS"))
REDDIT_HOST_SUFFIXES = csv_env("PRODUCTIVE_PROXY_REDDIT_HOST_SUFFIXES")
YOUTUBE_HOST_SUFFIXES = csv_env("PRODUCTIVE_PROXY_YOUTUBE_HOST_SUFFIXES")
YOUTUBE_SHORTS_PATH_MARKERS = csv_env("PRODUCTIVE_PROXY_YOUTUBE_SHORTS_PATH_MARKERS")

if REDDIT_IDLE_SECONDS <= 0:
    raise RuntimeError("PRODUCTIVE_PROXY_REDDIT_IDLE_SECONDS must be greater than 0")

if REDDIT_DAILY_LIMIT_SECONDS <= 0:
    raise RuntimeError("PRODUCTIVE_PROXY_REDDIT_DAILY_LIMIT_SECONDS must be greater than 0")


def host_matches(host: str, suffixes: list[str]) -> bool:
    normalized = host.lower().strip(".")
    return any(normalized == suffix or normalized.endswith(f".{suffix}") for suffix in suffixes)


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {
            "reddit": {
                "total_seconds": 0.0,
                "daily_seconds": {},
                "last_seen_at": None,
                "last_event": None,
            }
        }
    return json.loads(STATE_PATH.read_text())


def save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, sort_keys=True))


def append_event(event: dict) -> None:
    EVENT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with EVENT_LOG_PATH.open("a") as file:
        file.write(json.dumps(event, sort_keys=True) + "\n")


def utc_iso(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()


def utc_day(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).date().isoformat()


def path_matches_marker(path: str) -> bool:
    normalized = path.lower()
    return any(
        normalized == marker or normalized.startswith(f"{marker}/")
        for marker in YOUTUBE_SHORTS_PATH_MARKERS
    )


def url_matches_shorts(url: str) -> bool:
    if not url:
        return False

    parsed = urlsplit(url)
    if parsed.hostname and not host_matches(parsed.hostname, YOUTUBE_HOST_SUFFIXES):
        return False

    return path_matches_marker(parsed.path)


def request_body_mentions_shorts(flow: http.HTTPFlow) -> bool:
    body = flow.request.get_text(strict=False).lower()
    decoded_body = unquote(body)
    return any(marker in body or marker in decoded_body for marker in YOUTUBE_SHORTS_PATH_MARKERS)


def is_youtube_shorts(flow: http.HTTPFlow) -> bool:
    host = flow.request.pretty_host
    if not host_matches(host, YOUTUBE_HOST_SUFFIXES):
        return False

    if url_matches_shorts(flow.request.pretty_url):
        return True

    referer = flow.request.headers.get("referer", "")
    if url_matches_shorts(referer):
        return True

    return request_body_mentions_shorts(flow)


def block_youtube_shorts(flow: http.HTTPFlow) -> None:
    body = """
<!doctype html>
<html>
  <head><title>Blocked</title></head>
  <body>
    <h1>YouTube Shorts blocked</h1>
    <p>This request was blocked by ProductiveProxy.</p>
  </body>
</html>
""".strip()
    flow.response = http.Response.make(
        403,
        body.encode("utf-8"),
        {"Content-Type": "text/html; charset=utf-8"},
    )
    append_event(
        {
            "type": "youtube_shorts_blocked",
            "at": utc_iso(time.time()),
            "host": flow.request.pretty_host,
            "path": flow.request.path,
            "url": flow.request.pretty_url,
        }
    )


def block_reddit_daily_limit(flow: http.HTTPFlow, daily_seconds: float) -> None:
    body = """
<!doctype html>
<html>
  <head><title>Blocked</title></head>
  <body>
    <h1>Reddit daily limit reached</h1>
    <p>This request was blocked by ProductiveProxy.</p>
  </body>
</html>
""".strip()
    flow.response = http.Response.make(
        403,
        body.encode("utf-8"),
        {"Content-Type": "text/html; charset=utf-8"},
    )
    append_event(
        {
            "type": "reddit_daily_limit_blocked",
            "at": utc_iso(time.time()),
            "host": flow.request.pretty_host,
            "path": flow.request.path,
            "url": flow.request.pretty_url,
            "daily_seconds": round(daily_seconds, 3),
            "daily_limit_seconds": REDDIT_DAILY_LIMIT_SECONDS,
        }
    )


def track_reddit(flow: http.HTTPFlow) -> None:
    host = flow.request.pretty_host
    if not host_matches(host, REDDIT_HOST_SUFFIXES):
        return

    now = time.time()
    day = utc_day(now)
    state = load_state()
    reddit = state["reddit"]
    daily_seconds = reddit["daily_seconds"]
    current_daily_seconds = float(daily_seconds.get(day, 0.0))

    if current_daily_seconds >= REDDIT_DAILY_LIMIT_SECONDS:
        block_reddit_daily_limit(flow, current_daily_seconds)
        return

    last_seen = reddit.get("last_seen_at")
    event_type = "reddit_session_start"
    delta = 0.0

    if last_seen is not None:
        elapsed = now - float(last_seen)
        if elapsed <= REDDIT_IDLE_SECONDS:
            delta = elapsed
            event_type = "reddit_activity"
            reddit["total_seconds"] = float(reddit["total_seconds"]) + delta
            current_daily_seconds += delta
            daily_seconds[day] = current_daily_seconds

    reddit["last_seen_at"] = now
    reddit["last_event"] = {
        "type": event_type,
        "at": utc_iso(now),
        "delta_seconds": round(delta, 3),
        "daily_seconds": round(current_daily_seconds, 3),
        "daily_limit_seconds": REDDIT_DAILY_LIMIT_SECONDS,
        "host": host,
        "path": flow.request.path,
    }

    save_state(state)
    append_event(reddit["last_event"])

    if current_daily_seconds >= REDDIT_DAILY_LIMIT_SECONDS:
        block_reddit_daily_limit(flow, current_daily_seconds)


def request(flow: http.HTTPFlow) -> None:
    if is_youtube_shorts(flow):
        block_youtube_shorts(flow)
        return

    track_reddit(flow)
