# ProductivityProxy

ProductivityProxy is a dockless Tauri + React tray app that controls a local `mitmproxy` proxy.

It lets you build traffic policies as mode-specific visual graphs. The proxy logic runs in Python inside `mitmdump`.

## Project layout

```text
src/
  frontend/
    react/        React dashboard, Vite, npm scripts
    tauri/        Tauri v2 Rust shell and native commands
  proxy/          Python mitmproxy graph policy engine
scripts/          dev helper scripts
test/             Unit and integration tests
docs/             design/build docs
```

## Implemented

- Dockless tray/menu-bar app:
  - hidden dashboard at startup,
  - tray icon opens the dashboard,
  - close hides the dashboard instead of quitting,
  - macOS accessory activation policy.
- Dashboard:
  - proxy start/stop,
  - mode selector,
  - proxy settings,
  - LAN/Android setup panel,
  - visual graph editor,
  - custom Python block editor,
  - event viewer.
- Python graph policy engine:
  - graph nodes and edges,
  - built-in nodes: `block`, `log`, `track_time`, `notify`, `redirect`, `if`, `switch`, `start`, `end`,
  - arbitrary custom Python blocks loaded from files,
  - no custom-code sandboxing.
- Default modes:
  - `Productivity`: blocks YouTube Shorts and blocks Reddit after 30 minutes/day,
  - `Chilling`: allows traffic.
- Native notifications:
  - `notify` graph node writes notification events,
  - app displays those as desktop notifications.
- macOS system proxy control:
  - start enables HTTP and HTTPS system proxies on enabled network services,
  - stop disables those proxy states again.

## Install prerequisites

```bash
brew install mitmproxy
```

Rust, Node, and npm are also required for the desktop app.

## Run tests

Python proxy engine:

```bash
python3 -m unittest discover -s test -t . -p 'test_*.py'
```

Python unit tests only:

```bash
python3 -m unittest discover -s test/unit -t . -p 'test_*.py'
```

Python integration tests only:

```bash
python3 -m unittest discover -s test/integration -t . -p 'test_*.py'
```

React app:

```bash
cd src/frontend/react
npm test
npm run build
```

Rust/Tauri backend:

```bash
cd src/frontend/tauri
cargo test
```

Tauri compile check:

```bash
cd src/frontend/react
npm run tauri build -- --debug --no-bundle
```

## Run the desktop app

```bash
cd src/frontend/react
npm run tauri dev
```

The dashboard starts hidden. Use the tray/menu-bar icon to open it.

## Run the dev proxy directly

```bash
set -a
source .env.example
set +a

./scripts/run_mitm.sh
```

Default graph config:

```text
src/proxy/defaults/default_config.json
```

## Notes

- Custom Python blocks run with local process permissions and mitmproxy SDK access.
- Graph loops are allowed and currently have no loop guard.
- Starting/stopping from the desktop app toggles macOS HTTP/HTTPS system proxy settings for enabled network services.
- Linux system proxy automation is still postponed because desktop environments differ.
- Bundling mitmproxy inside the app is postponed.
