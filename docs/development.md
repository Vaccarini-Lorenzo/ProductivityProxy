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

Proxy evaluation requires a loop guard:

```bash
export POLICY_MAX_STEPS="1000"
```

The desktop app checks this variable before `start_proxy` launches `mitmdump`. The manual proxy helper loads it from `.env.example`.

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

Tauri compile check without bundling:

```bash
cd src/frontend/react
npm run tauri build -- --debug --no-bundle
```

## Run the app

```bash
export POLICY_MAX_STEPS="1000"
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

The helper script uses `.env.example` for listener, runtime file paths, auth, and `POLICY_MAX_STEPS`. It creates `PRODUCTIVE_PROXY_CONFIG_PATH` from `src/proxy/defaults/default_config.json` when that file does not exist.

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
2. `POLICY_MAX_STEPS` is set in the shell that starts the desktop app.
3. Tauri app starts.
4. Start proxy from Settings.
5. macOS system proxy points at `127.0.0.1:<port>`.
6. Browser traffic works.
7. mitmproxy CA is trusted for HTTPS.
8. Stop proxy restores previous macOS proxy state.
9. Python, Rust, and React tests pass.
