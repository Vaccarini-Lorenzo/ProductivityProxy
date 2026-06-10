#!/usr/bin/env bash
set -euo pipefail

# Load the engine config the same way as the proxy before running:
#   set -a; source .env.example; set +a
#   ./scripts/run_bench.sh
: "${POLICY_MAX_STEPS:?Missing POLICY_MAX_STEPS}"
: "${PRODUCTIVE_PROXY_TELEMETRY_VERBOSE:?Missing PRODUCTIVE_PROXY_TELEMETRY_VERBOSE}"
: "${PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES:?Missing PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES}"
: "${PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS:?Missing PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS}"

# Benchmark workload sizes. Override by exporting before running.
export BENCH_N_BLOCK="${BENCH_N_BLOCK:-20000}"
export BENCH_N_TRACK="${BENCH_N_TRACK:-10000}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec python3 "$ROOT/scripts/bench.py"
