#!/usr/bin/env python3
"""Hot-path performance benchmark for the policy engine.

Runs representative policies through ``PolicyEvaluator`` and reports per-request
latency, telemetry volume, and the cost of an observability read, so the numbers
can be re-run as a regression check after engine changes.

Workload size comes from ``BENCH_N_BLOCK`` and ``BENCH_N_TRACK``. The engine reads
its usual ``POLICY_MAX_STEPS`` and ``PRODUCTIVE_PROXY_*`` variables, so the report
reflects whatever telemetry/state configuration is currently active.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import time
import uuid
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "src"))

from proxy.models.policy.flow import AppConfig
from proxy.models.runtime.context import RequestContext
from proxy.services.events.event_log import EventLog
from proxy.services.policy.evaluator import PolicyEvaluator
from proxy.services.state.state_store import StateStore

NODES = REPO / "src" / "proxy" / "defaults" / "nodes"


class _Request:
    def __init__(self, host: str, path: str):
        self.method = "GET"
        self.host = self.pretty_host = host
        self.path = path
        self.url = self.pretty_url = f"http://{host}{path}"
        self.headers: dict[str, str] = {}
        self.content = b""


class _Flow:
    def __init__(self, host: str, path: str):
        self.request = _Request(host, path)
        self.response = None


class _CountingEventLog(EventLog):
    """EventLog that counts emissions, so telemetry volume is measured at the
    source rather than from the (compacted, byte-bounded) file on disk."""

    def __init__(self, path: Path):
        super().__init__(path)
        self.count = 0

    def append(self, event: dict) -> None:
        self.count += 1
        super().append(event)


def _env_int(name: str) -> int:
    if name not in os.environ:
        raise RuntimeError(f"Missing {name}")
    value = int(os.environ[name])
    if value <= 0:
        raise ValueError(f"{name} must be greater than zero")
    return value


def _block_config() -> AppConfig:
    """Simplest policy: a Start trigger that blocks YouTube Shorts."""
    return AppConfig.from_dict({
        "activeModeId": "m",
        "policies": [{"id": "p", "name": "Block Shorts", "steps": [
            {"id": "start", "kind": "node", "type": "start",
             "params": {"code": "def triggered_by(request):\n    return '/shorts' in request.path"}},
            {"id": "block", "kind": "node", "type": "block", "params": {"status": 403, "message": "no"}},
        ], "edges": [{"from": "start", "output": "next", "to": "block"}]}],
        "modes": [{"id": "m", "name": "M", "policyIds": ["p"]}],
        "customNodes": [{"id": "block", "name": "Block", "path": str(NODES / "block_response.py")}],
    })


def _track_config() -> AppConfig:
    """State-heavy policy: track time, check a (never-reached) limit, fall through."""
    return AppConfig.from_dict({
        "activeModeId": "m",
        "policies": [{"id": "p", "name": "Reddit budget", "steps": [
            {"id": "start", "kind": "node", "type": "start",
             "params": {"code": "def triggered_by(request):\n    return True"}},
            {"id": "track", "kind": "node", "type": "track", "params": {"platform": "reddit", "idleSeconds": 3600}},
            {"id": "limit", "kind": "node", "type": "limit", "params": {"platform": "reddit", "seconds": 1000000000000}},
            {"id": "over", "kind": "operator", "type": "if",
             "params": {"code": "def if_condition(input):\n    return input['over_limit']"}},
            {"id": "block", "kind": "node", "type": "block", "params": {"status": 403, "message": "no"}},
            {"id": "end", "kind": "node", "type": "end"},
        ], "edges": [
            {"from": "start", "output": "next", "to": "track"},
            {"from": "track", "output": "next", "to": "limit"},
            {"from": "limit", "output": "next", "to": "over"},
            {"from": "over", "output": "then", "to": "block"},
            {"from": "over", "output": "else", "to": "end"},
        ]}],
        "modes": [{"id": "m", "name": "M", "policyIds": ["p"]}],
        "customNodes": [
            {"id": "track", "name": "Track", "path": str(NODES / "track_time.py")},
            {"id": "limit", "name": "Limit", "path": str(NODES / "is_usage_over_limit.py")},
            {"id": "block", "name": "Block", "path": str(NODES / "block_response.py")},
        ],
    })


def _benchmark(config: AppConfig, host: str, path: str, requests: int, workdir: Path) -> dict:
    event_path = workdir / f"{host}.jsonl"
    evaluator = PolicyEvaluator(config)
    event_log = _CountingEventLog(event_path)
    state = StateStore(workdir / f"{host}.state.json")

    started = time.perf_counter()
    for _ in range(requests):
        context = RequestContext(
            flow=_Flow(host, path), config=config, state=state,
            event_log=event_log, request_id=uuid.uuid4().hex,
        )
        evaluator.evaluate(context)
    elapsed = time.perf_counter() - started

    state.close()
    event_log.flush()
    size = event_path.stat().st_size
    return {
        "us_per_req": elapsed / requests * 1e6,
        "events_per_req": event_log.count / requests,
        "file_mb": size / 1e6,
        "query_ms": _query_cost(event_path),
        "requests": requests,
    }


def _query_cost(event_path: Path) -> float:
    """Mirror the dashboard read: scan the whole file, parse and search each event."""
    started = time.perf_counter()
    for line in event_path.read_text().splitlines():
        if line.strip():
            json.dumps(json.loads(line)).lower().find("no-such-token")
    return (time.perf_counter() - started) * 1000


def _print(name: str, metric: dict) -> None:
    print(f"\n── {name}  ({metric['requests']} requests) ───────────────────")
    print(f"   latency            {metric['us_per_req']:8.2f}  µs/request")
    print(f"   telemetry          {metric['events_per_req']:8.2f}  events/request (emitted)")
    print(f"   event log file     {metric['file_mb']:8.2f}  MB (bounded by budget)")
    print(f"   observability read {metric['query_ms']:8.1f}  ms (whole-file scan)")


def main() -> None:
    n_block = _env_int("BENCH_N_BLOCK")
    n_track = _env_int("BENCH_N_TRACK")
    workdir = Path(tempfile.mkdtemp(prefix="ppbench_"))

    print("ProductivityProxy engine benchmark")
    print(f"   verbose telemetry : {os.environ['PRODUCTIVE_PROXY_TELEMETRY_VERBOSE']}")
    print(f"   event log budget  : {int(os.environ['PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES']):,} bytes")
    print(f"   state flush every : {os.environ['PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS']} s")

    block = _benchmark(_block_config(), "www.youtube.com", "/shorts/x", n_block, workdir)
    track = _benchmark(_track_config(), "www.reddit.com", "/r/x", n_track, workdir)
    _print("Block Shorts  (Start → Block)", block)
    _print("Reddit budget (Start → Track → Limit → If → End)", track)
    print()

    # Machine-readable line for CI (badge value). Kept on one line on purpose.
    summary = {
        "block_us": round(block["us_per_req"], 1),
        "track_us": round(track["us_per_req"], 1),
        "block_events": round(block["events_per_req"], 2),
        "track_events": round(track["events_per_req"], 2),
        "latency_label": f"{round(block['us_per_req'])} µs/req",
    }
    print("bench-json " + json.dumps(summary))


if __name__ == "__main__":
    main()
