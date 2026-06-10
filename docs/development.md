# Development Guide

## Prerequisites

- Python 3
- mitmproxy (`mitmdump` on `PATH`)
- Rust toolchain
- Node.js and npm

Install Python dependency:

```bash
python3 -m pip install -r requirements.txt
```

Install frontend dependencies:

```bash
cd src/frontend/react
npm install
```

## Environment

The proxy engine requires these environment variables and fails fast when any is missing:

```bash
export POLICY_MAX_STEPS="1000"                    # evaluator loop guard
export PRODUCTIVE_PROXY_TELEMETRY_VERBOSE="false" # "true" emits the full per-step trace
export PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES="5000000" # event log byte budget (compacted)
export PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS="2"   # state write-behind interval
```

The desktop app pre-checks only `POLICY_MAX_STEPS` before `start_proxy` launches `mitmdump`; the other three are enforced by the Python engine at runtime, so all four must be present in the environment the app starts `mitmdump` from. `mitmdump` inherits them from the app's environment. The manual proxy helper loads them from `.env.example`.

## Run tests

All Python tests:

```bash
PYTHONPATH=src POLICY_MAX_STEPS=1000 python3 -m unittest discover -s test -t . -p 'test_*.py'
```

Python unit tests only:

```bash
PYTHONPATH=src POLICY_MAX_STEPS=1000 python3 -m unittest discover -s test/unit -t . -p 'test_*.py'
```

Python integration tests only:

```bash
PYTHONPATH=src POLICY_MAX_STEPS=1000 python3 -m unittest discover -s test/integration -t . -p 'test_*.py'
```

Rust/Tauri tests:

```bash
cd src/frontend/tauri
cargo test
```

React tests and build:

```bash
cd src/frontend/react
npm test
npm run build
```

## Benchmark

`scripts/bench.py` measures the engine hot path (per-request latency, emitted telemetry volume, and observability read cost) for the current code, so it can be re-run as a regression check. Load the engine variables the same way as the proxy, then run the wrapper:

```bash
set -a; source .env.example; set +a
./scripts/run_bench.sh
```

Workload size is set by `BENCH_N_BLOCK` and `BENCH_N_TRACK` (e.g. `BENCH_N_TRACK=50000 ./scripts/run_bench.sh`). Telemetry verbosity follows `PRODUCTIVE_PROXY_TELEMETRY_VERBOSE`, so flipping it shows the per-step trace cost.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests:

- **python** — installs `requirements.txt` and runs the `unittest` suite.
- **frontend** — `npm ci`, `npm test`, `npm run build` in `src/frontend/react`.
- **benchmark** — runs `scripts/run_bench.sh` (after `python` passes). On pushes to `main` it commits the block-policy latency to `assets/pp-latency.json` (loop-guarded with `[skip ci]`, only when the value changes), which feeds the latency badge in the README. The number reflects the CI runner, so it is noisier/slower than a local run.

The Tauri/Rust shell is not built in CI: it has no `#[test]` targets yet and compiling it needs webkit system dependencies. Add a job when Rust tests exist.

Tauri compile check without bundling:

```bash
cd src/frontend/react
npm run tauri build -- --debug --no-bundle
```

## Run the app

Export the engine variables from [Environment](#environment), then:

```bash
cd src/frontend/react
npm run tauri dev
```

The dashboard window starts hidden. Open it from the tray/menu-bar icon.

## Run only the proxy

```bash
set -a
source .env.example
set +a
./scripts/run_mitm.sh
```

The helper script uses `.env.example` for listener, runtime file paths, auth, and the engine variables (`POLICY_MAX_STEPS`, `PRODUCTIVE_PROXY_TELEMETRY_VERBOSE`, `PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES`, `PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS`). It creates `PRODUCTIVE_PROXY_CONFIG_PATH` from `src/proxy/defaults/default_config.json` when that file does not exist.

If the config schema changes, delete the file at `PRODUCTIVE_PROXY_CONFIG_PATH` before running the helper so it regenerates from the current default config.

## Main source map

```text
src/proxy/                         Python mitmproxy addon and graph engine
src/frontend/tauri/                Rust/Tauri shell and native commands
src/frontend/react/                React dashboard
test/unit/                         Python, React, and Rust unit tests
test/integration/                  Python graph integration tests
docs/architecture/                 architecture and contracts
docs/roadmap/                      readiness and remaining work
```

## Important conventions

- Keep source files under 300 lines.
- Prefer simple, linear code.
- Do not add broad abstraction layers without a concrete need.
- Required runtime environment variables should fail fast when missing.
- Custom Python blocks are intentionally not sandboxed.

## Backend development notes

The Tauri backend writes app data files and starts `mitmdump` directly.

When changing proxy start/stop behavior, check:

- `src/frontend/tauri/src/controller/commands.rs`,
- `src/frontend/tauri/src/services/proxy/mitmdump_args.rs`,
- `src/frontend/tauri/src/services/proxy/process_service.rs`,
- `src/frontend/tauri/src/services/system_proxy/mod.rs`,
- `test/unit/frontend/tauri/`.

## Python engine development notes

When adding built-in flow behavior, update:

- `src/proxy/services/policy/operators.py` for routing operators,
- `src/proxy/services/config/validation.py` for config/node validation rules,
- `src/proxy/models/policy/flow.py` for the runtime config model,
- Python unit tests,
- data/config docs if params or event schemas change.

For custom node behavior, check:

- `src/proxy/services/policy/custom_nodes.py`,
- default nodes under `src/proxy/defaults/nodes/`,
- custom node tests.

## React development notes

React code calls Tauri through thin repository functions. Prefer keeping Tauri command names contained in services rather than spreading them through views.

Because the UI is changing, run React tests/build after UI work settles:

```bash
cd src/frontend/react
npm test
npm run build
```

## Manual checks before daily use

1. `mitmdump --version` works.
2. The required proxy environment variables (`POLICY_MAX_STEPS`, `PRODUCTIVE_PROXY_TELEMETRY_VERBOSE`, `PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES`, `PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS`) are set in the shell that starts the desktop app.
3. Tauri app starts.
4. Start proxy from Settings.
5. macOS system proxy points at `127.0.0.1:<port>`.
6. Browser traffic works.
7. mitmproxy CA is trusted for HTTPS.
8. Stop proxy restores previous macOS proxy state.
9. Python, Rust, and React tests pass.
