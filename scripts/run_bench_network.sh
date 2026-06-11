#!/usr/bin/env bash
set -euo pipefail

# End-to-end network benchmark: latency and throughput with the proxy on vs off.
# The proxy must already be running (the app, or ./scripts/run_mitm.sh).
#
#   ./scripts/run_bench_network.sh
#   BENCH_NET_PAYLOAD_MB=200 ./scripts/run_bench_network.sh   # to scale

# Defaults. Override by exporting before running.
export BENCH_NET_PROXY="${BENCH_NET_PROXY:-http://127.0.0.1:8080}"
export BENCH_NET_ORIGIN_PORT="${BENCH_NET_ORIGIN_PORT:-9911}"
export BENCH_NET_PAYLOAD_MB="${BENCH_NET_PAYLOAD_MB:-50}"
export BENCH_NET_THROUGHPUT_ITERS="${BENCH_NET_THROUGHPUT_ITERS:-10}"
export BENCH_NET_LATENCY_ITERS="${BENCH_NET_LATENCY_ITERS:-50}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec python3 "$ROOT/scripts/bench_network.py"
