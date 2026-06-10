# Tauri Desktop Backend

## Location

```text
src/frontend/tauri/
```

The backend is a Tauri v2 Rust app. It exposes commands to the React dashboard and owns native desktop behavior.

## Entry points

- `src/main.rs` calls `productivity_proxy_app::run()`.
- `src/lib.rs` builds the Tauri app, registers commands, sets up tray behavior, and hides the window on close.

## Runtime state

`AppState` stores:

- `ProcessService` for the `mitmdump` child process,
- an optional in-memory `SystemProxySnapshot` captured before enabling the macOS system proxy.

Both fields are protected with `Mutex` because Tauri commands can run concurrently.

The snapshot is also **persisted to disk** (`system_proxy_snapshot.json`, written by `services/system_proxy/lease.rs`) so the previous system proxy state survives a crash or force-kill and can be restored on the next launch. See [macOS system proxy handling](#macos-system-proxy-handling).

## Command implementation

Stable command contracts live in [Command Contracts](../4_data_layer/command-contracts.md).

Important implementation details:

- `read_app_config` materializes the default config on first read.
- `write_custom_node` writes under app data `custom_nodes/` and strips path traversal from the file name.
- `read_custom_node` allows app-data custom nodes and bundled default-node paths.
- `start_proxy` requires `POLICY_MAX_STEPS` in the environment before it writes config or starts the child process.
- `proxy_status` restores system proxy settings if the child process died.

## App data paths

`RuntimePaths` maps the Tauri app data directory to:

```text
config.json
state.json
events.jsonl
system_proxy_snapshot.json
custom_nodes/
```

It also stores the repo-local addon path:

```text
src/proxy/addons/policy_proxy.py
```

The repo root is discovered by walking upward from the current directory until `src/proxy/addons/policy_proxy.py` is found. This works for development but is a packaging risk.

## Proxy process launch

`build_mitmdump_args` builds arguments like:

```text
--listen-host 127.0.0.1|0.0.0.0
--listen-port <port>
-s <repo>/src/proxy/addons/policy_proxy.py
--set productive_config_path=<app-data>/config.json
--set productive_state_path=<app-data>/state.json
--set productive_event_log_path=<app-data>/events.jsonl
```

If proxy auth is enabled, it adds:

```text
--proxyauth <username>:<password>
```

`ProcessService` starts `mitmdump`, stores the child handle, checks liveness with `try_wait`, and kills/waits during stop or drop.

Current limitation: stdout and stderr are discarded, so proxy startup failures may be hard to diagnose from the UI.

## macOS system proxy handling

The backend uses `networksetup` on macOS.

Start flow:

1. List enabled network services.
2. Snapshot HTTP and HTTPS proxy settings for each service.
3. Reject startup if an existing authenticated proxy is detected.
4. Start `mitmdump`.
5. Set HTTP and HTTPS proxy to `127.0.0.1:<port>` for each captured service.
6. Turn both proxy states on.

Stop flow:

1. Take the snapshot (the in-memory one, or load `system_proxy_snapshot.json` from disk when memory is empty).
2. Restore previous enabled state for HTTP and HTTPS.
3. Restore previous server and port only when the previous proxy was enabled and had endpoint data.
4. On success, delete `system_proxy_snapshot.json`. If restore fails, keep both the in-memory snapshot and the file so a later stop/status call (or the next launch) can retry.

If a previous proxy was disabled or missing endpoint data, restore only turns that proxy state off; it may not restore the old server/port fields.

### Durable restore across crashes

`start_proxy` writes `system_proxy_snapshot.json` right after capturing the snapshot (`save_system_proxy_snapshot`) and removes it on every rollback path, so restore is durable:

- `controller/proxy_lifecycle.rs::restore_marked_system_proxy` restores from the in-memory snapshot, or loads the file from disk when memory is empty (e.g. after a restart), then deletes it.
- `start_proxy`, `stop_proxy`, and `proxy_status` (when the child is not running) all call `restore_marked_system_proxy`, so a crashed session is recovered on the next app launch.
- `start_proxy_monitor` runs a background thread that restores the system proxy if `mitmdump` dies unexpectedly.
- On app exit, `lib.rs` handles `RunEvent::Exit` by calling `shutdown_cleanup` (restore system proxy + stop the child).

Manual `networksetup` recovery is a fallback, not the primary path.

Non-macOS behavior:

- snapshot is a no-op,
- restore is a no-op,
- enable returns `Unsupported`.

Because `start_proxy` always enables the system proxy, starting the desktop proxy currently fails on non-macOS.

## Tray and window behavior

The app starts with the main window hidden. `tauri.conf.json` declares two windows: the hidden `main` dashboard and a decorationless, transparent, always-on-top `popover`.

Tray interactions:

- **Left-click** toggles the menu-bar **popover** window (`show_menu_on_left_click(false)`).
- **Right-click** opens the native menu with `Open Dashboard` and `Quit`.
- `Open Dashboard` shows and focuses the main window (and hides the popover).
- `Quit` stops the proxy and restores system proxy settings before exiting, and **refuses to exit if that cleanup fails**, so it never leaves the system proxy enabled.

### Popover window

`controller/tray/popover.rs` owns the popover surface:

- `toggle_popover` shows/hides it from the tray left-click.
- it is centered below the tray icon, clamped to the monitor work area with a small edge margin and a gap from the icon.
- it auto-dismisses when it loses focus (click outside), with a short reopen guard so the dismissing click does not immediately reopen it.
- `resize_popover` resizes it to the webview content height (capped to the work area); `show_main_window` hides it when revealing the dashboard.

Closing the main window hides it instead of quitting. On macOS the activation policy is set to accessory mode, so the app behaves like a menu-bar app.

## Error handling model

Most command errors are converted to strings and returned to the React layer.

Important rollback behavior:

- If system proxy enable fails after `mitmdump` starts, the backend restores the captured proxy snapshot and stops `mitmdump`.
- If storing the snapshot fails, the backend restores the snapshot and stops `mitmdump`.

## Tests

Rust test targets are registered in `src/frontend/tauri/Cargo.toml` and live under:

```text
test/unit/frontend/tauri/
```

Coverage includes file store, runtime paths, event log reads, network info, mitmdump arg generation, process lifecycle, tray action mapping, and macOS system proxy command construction/parsing.
