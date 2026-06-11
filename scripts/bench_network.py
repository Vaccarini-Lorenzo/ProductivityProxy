#!/usr/bin/env python3
"""End-to-end network benchmark: latency and throughput with the proxy on vs off.

Unlike ``scripts/bench.py`` (which times the in-process policy engine in
microseconds), this drives real HTTP requests with ``curl`` against a local
in-memory origin and compares a direct connection to one routed through the
running proxy. Keeping the origin on loopback isolates the proxy's own relay and
policy-evaluation cost from internet variance, so the numbers are repeatable.

It measures two things:
  * latency    - total time for a tiny request (per-request overhead)
  * throughput - download speed for a large body (bandwidth ceiling)

The target host is neutral (127.0.0.1), so no demo policy matches: this is the
pass-through overhead, i.e. the cost the proxy adds when it is NOT blocking.

Tweakables (env vars, required; see run_bench_network.sh for defaults):
  BENCH_NET_PROXY             proxy URL, e.g. http://127.0.0.1:8080
  BENCH_NET_ORIGIN_PORT       local origin port
  BENCH_NET_PAYLOAD_MB        throughput payload size in MB
  BENCH_NET_THROUGHPUT_ITERS  iterations for the throughput test
  BENCH_NET_LATENCY_ITERS     iterations for the latency test
"""
from __future__ import annotations

import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def _env(name: str) -> str:
    if name not in os.environ:
        raise RuntimeError(f"Missing {name}")
    return os.environ[name]


def _env_int(name: str) -> int:
    value = int(_env(name))
    if value <= 0:
        raise ValueError(f"{name} must be greater than zero")
    return value


def _build_origin(payload: bytes) -> ThreadingHTTPServer:
    """A loopback origin: /big returns the payload, /small returns a few bytes."""

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def do_GET(self) -> None:  # noqa: N802 (http.server API)
            body = payload if self.path == "/big" else b"ok"
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_args) -> None:  # silence per-request logging
            pass

    port = _env_int("BENCH_NET_ORIGIN_PORT")
    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def _curl(url: str, proxy: str | None) -> dict[str, float]:
    """One curl request. Returns its timing breakdown, or raises on failure."""
    fmt = "%{http_code} %{time_total} %{time_connect} %{time_starttransfer} %{speed_download} %{size_download}"
    cmd = ["curl", "-s", "-o", "/dev/null", "-w", fmt, "--max-time", "60"]
    if proxy:
        cmd += ["-x", proxy]
    else:
        cmd += ["--noproxy", "*"]  # ignore any *_proxy env: a true direct call
    cmd.append(url)

    out = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout.split()
    code = int(float(out[0]))
    if code != 200:
        raise RuntimeError(f"{'proxy' if proxy else 'direct'} {url} -> HTTP {code}")
    return {
        "total_ms": float(out[1]) * 1000,
        "connect_ms": float(out[2]) * 1000,
        "ttfb_ms": float(out[3]) * 1000,
        "mbps": float(out[4]) / 1e6,
        "bytes": float(out[5]),
    }


def _percentile(values: list[float], pct: float) -> float:
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(round(pct / 100 * (len(ordered) - 1))))
    return ordered[index]


def _measure(url: str, proxy: str | None, iters: int, key: str) -> tuple[float, float]:
    _curl(url, proxy)  # warmup: prime upstream connection and caches
    samples = [_curl(url, proxy)[key] for _ in range(iters)]
    return _percentile(samples, 50), _percentile(samples, 90)


def _row(label: str, off: float, on: float, unit: str, lower_is_better: bool) -> str:
    if lower_is_better:
        delta = (on - off) / off * 100 if off else 0.0
        change = f"+{delta:.1f}% slower" if delta >= 0 else f"{delta:.1f}% faster"
    else:
        delta = (on - off) / off * 100 if off else 0.0
        change = f"{delta:.1f}% lower" if delta < 0 else f"+{delta:.1f}% higher"
    return f"   {label:<22}{off:>12.2f}{on:>12.2f}  {unit:<7}{change}"


def main() -> None:
    proxy = _env("BENCH_NET_PROXY")
    payload_mb = _env_int("BENCH_NET_PAYLOAD_MB")
    t_iters = _env_int("BENCH_NET_THROUGHPUT_ITERS")
    l_iters = _env_int("BENCH_NET_LATENCY_ITERS")

    origin = _build_origin(os.urandom(payload_mb * 1_000_000))
    host, port = origin.server_address
    base = f"http://{host}:{port}"
    threading.Thread(target=origin.serve_forever, daemon=True).start()

    print("ProductivityProxy network benchmark (proxy off vs on)")
    print(f"   proxy            : {proxy}")
    print(f"   local origin     : {base}")
    print(f"   payload          : {payload_mb} MB")
    print(f"   iterations       : {l_iters} latency, {t_iters} throughput")
    print("   target is neutral (no demo policy matches): pass-through overhead\n")

    lat_off, lat_off90 = _measure(f"{base}/small", None, l_iters, "total_ms")
    lat_on, lat_on90 = _measure(f"{base}/small", proxy, l_iters, "total_ms")
    con_off, _ = _measure(f"{base}/small", None, l_iters, "connect_ms")
    con_on, _ = _measure(f"{base}/small", proxy, l_iters, "connect_ms")
    bw_off, _ = _measure(f"{base}/big", None, t_iters, "mbps")
    bw_on, _ = _measure(f"{base}/big", proxy, t_iters, "mbps")
    dl_off, _ = _measure(f"{base}/big", None, t_iters, "total_ms")
    dl_on, _ = _measure(f"{base}/big", proxy, t_iters, "total_ms")

    origin.shutdown()

    header = f"   {'metric':<22}{'OFF':>12}{'ON':>12}  unit"
    print("── Latency (small request) " + "─" * 24)
    print(header)
    print(_row("request time (p50)", lat_off, lat_on, "ms", True))
    print(_row("request time (p90)", lat_off90, lat_on90, "ms", True))
    print(_row("tcp connect (p50)", con_off, con_on, "ms", True))
    print(f"\n── Throughput ({payload_mb} MB download) " + "─" * 22)
    print(header)
    print(_row("bandwidth (p50)", bw_off, bw_on, "MB/s", False))
    print(_row("download time (p50)", dl_off, dl_on, "ms", True))

    print(
        "\nNote: loopback origin, so OFF speeds are near hardware limits and the\n"
        "ON/OFF gap is the proxy's pure overhead. On a real internet link the\n"
        "network, not the proxy, usually caps bandwidth, so the relative hit is\n"
        "smaller; the fixed per-request latency cost stays."
    )


if __name__ == "__main__":
    main()
