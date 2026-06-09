# ProductivityProxy

ProductivityProxy is becoming a dockless Tauri + React tray app that controls a local `mitmproxy` proxy.

The long-term goal is a visual policy graph editor where modes like `Productivity` and `Chilling` are built from blocks.

## Current architecture

```text
app/                 Tauri v2 + React desktop app
proxy/               Python mitmproxy graph policy engine
scripts/             dev helper scripts
tests/               Python proxy engine tests
docs/                design/build docs
```

The app is the controller. The proxy logic stays in Python and runs inside `mitmdump`.

## Implemented so far

- Dockless Tauri shell:
  - hidden dashboard at startup,
  - tray/menu-bar icon,
  - close hides the dashboard instead of quitting,
  - macOS accessory activation policy.
- React dashboard shell.
- Python graph policy engine:
  - graph nodes and edges,
  - built-in nodes: `block`, `log`, `track_time`, `notify`, `redirect`, `if`, `switch`, `start`, `end`,
  - arbitrary custom Python blocks loaded from files,
  - no custom-code sandboxing.
- Rust proxy command helpers:
  - build `mitmdump` arguments,
  - process start/stop service.
- Dev `mitmdump` script using graph config files instead of policy env vars.

## Install prerequisites

```bash
brew install mitmproxy
```

Rust, Node, and npm are also required for the desktop app.

## Run tests

Python proxy engine:

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
```

React app:

```bash
cd app
npm test
npm run build
```

Rust/Tauri backend:

```bash
cd app/src-tauri
cargo test
```

Tauri compile check:

```bash
cd app
npx tauri build --debug --no-bundle
```

## Run the dev proxy directly

```bash
set -a
source .env.example
set +a

./scripts/run_mitm.sh
```

Default config:

```text
proxy/defaults/default_config.json
```

The default config is intentionally minimal for now.

## Run the desktop app

```bash
cd app
npm run tauri dev
```

The dashboard starts hidden. Use the tray/menu-bar icon to open it.

## Notes

- Custom Python blocks run with local process permissions and mitmproxy SDK access.
- Graph loops are allowed and currently have no loop guard.
- Auto-changing macOS/Linux system proxy settings is postponed.
- Bundling mitmproxy inside the app is postponed.
