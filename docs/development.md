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
export PRODUCTIVE_PROXY_FRICTION_SECONDS="1200"   # 20-minute manual mode-switch delay
export PRODUCTIVE_PROXY_TELEMETRY_VERBOSE="false" # "true" emits the full per-step trace
export PRODUCTIVE_PROXY_EVENT_LOG_MAX_BYTES="5000000" # event log byte budget (compacted)
export PRODUCTIVE_PROXY_EVENT_QUEUE_MAX_ITEMS="1000"   # pending in-memory event cap
export PRODUCTIVE_PROXY_ASYNC_QUEUE_MAX_ITEMS="100"    # pending background-job cap
export PRODUCTIVE_PROXY_STREAM_LARGE_BODIES="1m"       # HTTP body streaming threshold
export PRODUCTIVE_PROXY_STATE_FLUSH_SECONDS="2"         # state write-behind interval
```

The desktop mode runtime reads `PRODUCTIVE_PROXY_FRICTION_SECONDS` when reporting mode state or starting a friction timer. Before launching `mitmdump`, the desktop app checks every engine variable above except friction, which is checked during app setup. All eight values must be present in the environment that starts the desktop app. `mitmdump` inherits the engine values, and the manual proxy helper loads `.env.example`.

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

CI does not yet run the Rust/Tauri tests (they run locally via `cargo test`, see [Run tests](#run-tests)) because compiling the shell needs webkit system dependencies; add a CI job when that is set up.

Tauri compile check without bundling:

```bash
cd src/frontend/react
npm run tauri build -- --debug --no-bundle
```

Local macOS app build:

```bash
cd src/frontend/react
npm run tauri build -- --bundles app
```

Local DMG from the built app:

```bash
hdiutil create -volname ProductivityProxy \
  -srcfolder ../tauri/target/release/bundle/macos/ProductivityProxy.app \
  -ov -format UDZO \
  ../tauri/target/release/bundle/dmg/ProductivityProxy_local_0.1.0_aarch64.dmg
```

The app bundle is written to:

```text
src/frontend/tauri/target/release/bundle/macos/ProductivityProxy.app
```

The DMG is written to:

```text
src/frontend/tauri/target/release/bundle/dmg/ProductivityProxy_local_0.1.0_aarch64.dmg
```

The bundled app includes the Python proxy source, but still expects `python3` and `mitmdump` on the host. For Finder-launched apps, put the required engine environment and a Homebrew-aware `PATH` in:

```text
~/Library/Application Support/com.productivityproxy.desktop/.env
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

The helper script uses `.env.example` for listener, runtime file paths, auth, and the engine variables from [Environment](#environment). It creates `PRODUCTIVE_PROXY_CONFIG_PATH` from `src/proxy/defaults/default_config.json` when that file does not exist.

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
2. The required proxy environment variables from [Environment](#environment) are set in the shell that starts the desktop app.
3. Tauri app starts.
4. Start proxy from Settings.
5. macOS system proxy points at `127.0.0.1:<port>`.
6. Browser traffic works.
7. mitmproxy CA is trusted for HTTPS.
8. Stop proxy restores previous macOS proxy state.
9. Python, Rust, and React tests pass.
