# Roadmap and Readiness

## Current state

ProductivityProxy has a working local development architecture:

- Tauri tray/menu-bar app,
- hidden dashboard window,
- Rust commands for config, proxy lifecycle, events, and network info,
- `mitmdump` child process launch,
- Python policy engine,
- default productivity/chilling modes,
- custom Python node loading,
- local state and JSONL event persistence,
- React dashboard for settings, custom nodes, and policy editing,
- macOS HTTP/HTTPS system proxy snapshot/restore.

Python and Rust tests pass in the current backend state. React validation should be rerun after active UI edits settle.

## What is good enough now

The project is good enough for:

- local development,
- testing policy behavior,
- careful macOS trials,
- validating custom nodes,
- iterating on the dashboard UX.

## Not ready for broad daily use yet

The app is not yet polished enough for normal users because:

- mitmproxy must be installed manually,
- mitmproxy CA installation/trust is manual,
- packaged app runtime paths are not solved,
- proxy process logs are discarded,
- custom Python nodes are unsandboxed,
- policy loops are guarded by POLICY_MAX_STEPS,
- config validation is incomplete,
- Linux system proxy automation is unsupported,
- force-kill/crash can leave macOS proxy settings enabled.

## Completed implementation phases

### 1. Repository and app scaffold

Done:

- `src/proxy` Python engine structure,
- `src/frontend/tauri` Rust backend,
- `src/frontend/react` dashboard,
- Tauri app config,
- tray/menu-bar behavior,
- hidden window startup.

### 2. Proxy process manager

Done:

- builds `mitmdump` args from config,
- starts/stops child process,
- reports running state,
- stops on app quit.

Remaining:

- capture/display stderr/stdout,
- detect missing `mitmdump` before start,
- expose clearer startup diagnostics in UI.

### 3. Config and app data paths

Done:

- app data config/state/event paths,
- default config copy on first read,
- custom node directory,
- config read/write commands.

Remaining:

- safe custom node file-name validation,
- config migrations/versioning,
- stronger schema validation.

### 4. Python policy engine

Done:

- policy flow model,
- evaluator,
- built-in nodes,
- custom Python block runner,
- state store,
- event log,
- mitmproxy addon/controller,
- default policy tests.

Remaining:

- loop guard,
- node-level error events,
- node param validation,
- optional hot reload or restart prompt when config changes.

### 5. Default policies

Done:

- Productivity mode blocks YouTube Shorts,
- Productivity mode tracks Reddit,
- Productivity mode blocks Reddit after 30 minutes/day,
- Chilling mode allows traffic.

Remaining:

- make defaults easier to explain in the UI,
- add reset-to-defaults flow,
- add imported/exported policy packs later if needed.

### 6. React dashboard

Done:

- app shell/navigation,
- settings view,
- custom nodes view,
- policies view,
- React Flow graph canvas,
- Tauri command repositories,
- notification deduplication service.

Remaining:

- node parameter editor,
- event/log viewer in current UI,
- LAN/Android setup instructions in current UI,
- custom node file-content loading while editing,
- richer config validation feedback,
- final responsive/polish pass.

### 7. System proxy support

Done on macOS:

- snapshots enabled network services' HTTP/HTTPS proxy settings,
- rejects existing authenticated proxies for safe restore,
- enables HTTP/HTTPS proxy to `127.0.0.1:<port>`,
- restores previous settings on stop/quit/proxy death detection,
- rolls back when enable fails.

Remaining:

- durable crash recovery,
- explicit manual recovery UI/help,
- Linux desktop-environment-specific implementations,
- tests with multiple real macOS network service configurations.

### 8. Documentation

Done:

- documentation index,
- usage guide,
- development guide,
- architecture views,
- module/API contracts,
- assumptions and current limitations.

Remaining:

- screenshots after UI stabilizes,
- user-facing CA installation guide per OS/browser/device,
- packaged app installation guide when bundling exists.

## Recommended next work

1. Finish the active React UI pass without changing backend contracts unnecessarily.
2. Add policy step parameter editing.
3. Add event/log viewer back into the current UI.
4. Add a visible HTTPS CA setup/help panel.
5. Add proxy process log capture and missing-`mitmdump` diagnostics.
6. Tune POLICY_MAX_STEPS defaults/documentation.
7. Add stronger config validation shared between frontend and backend expectations.
8. Decide packaging strategy for mitmproxy/Python/addon files.

## Verification checklist

Run after backend and UI settle:

```bash
python3 -m unittest discover -s test -t . -p 'test_*.py'
cd src/frontend/tauri && cargo test
cd src/frontend/react && npm test
cd src/frontend/react && npm run build
cd src/frontend/react && npm run tauri build -- --debug --no-bundle
```

Manual macOS check:

1. Record current system proxy settings.
2. Start app from Tauri dev.
3. Start proxy from Settings.
4. Confirm macOS HTTP/HTTPS proxy points to `127.0.0.1:<port>`.
5. Browse HTTP and HTTPS with trusted mitmproxy CA.
6. Stop proxy.
7. Confirm previous system proxy settings are restored.

## Deferred non-goals

- Cloud sync.
- Accounts/authentication.
- Enterprise management.
- Plugin marketplace.
- Full sandbox for custom Python code.
- Polished installer/signing/notarization before runtime packaging is solved.
