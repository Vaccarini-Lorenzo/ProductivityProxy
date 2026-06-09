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
- an optional `SystemProxySnapshot` captured before enabling the macOS system proxy.

Both fields are protected with `Mutex` because Tauri commands can run concurrently.

## Tauri commands

| Command | Purpose |
| --- | --- |
| `read_app_config` | Ensure config exists, then read app config JSON. |
| `write_app_config` | Persist app config JSON. |
| `write_custom_block` | Write a Python custom block file under app data. |
| `start_proxy` | Save config, start `mitmdump`, enable macOS system proxy. |
| `stop_proxy` | Restore macOS system proxy and stop `mitmdump`. |
| `proxy_status` | Report whether `mitmdump` is still running; restore proxy settings if it died. |
| `read_recent_events` | Read the last N JSONL event entries. |
| `network_info` | Return `127.0.0.1` and best-effort LAN IP. |

## App data paths

`RuntimePaths` maps the Tauri app data directory to:

```text
config.json
state.json
events.jsonl
custom_blocks/
```

It also stores the repo-local addon path:

```text
src/proxy/addons/graph_proxy.py
```

The repo root is discovered by walking upward from the current directory until `src/proxy/addons/graph_proxy.py` is found. This works for development but is a packaging risk.

## Proxy process launch

`build_mitmdump_args` builds arguments like:

```text
--listen-host 127.0.0.1|0.0.0.0
--listen-port <port>
-s <repo>/src/proxy/addons/graph_proxy.py
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

1. Take the stored snapshot.
2. Restore previous server, port, and enabled state for HTTP and HTTPS.
3. If restore fails, put the snapshot back in state so a later stop/status call can retry.

Non-macOS behavior:

- snapshot is a no-op,
- restore is a no-op,
- enable returns `Unsupported`.

Because `start_proxy` always enables the system proxy, starting the desktop proxy currently fails on non-macOS.

## Tray and window behavior

The app starts with the main window hidden.

Tray/menu items:

- `Open Dashboard` shows and focuses the main window.
- `Quit` calls `stop_proxy` before exiting.

Closing the window hides it instead of quitting.

On macOS the activation policy is set to accessory mode, so the app behaves like a menu-bar app.

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

Coverage includes:

- file store,
- runtime paths,
- event log reads,
- network info,
- mitmdump arg generation,
- process lifecycle,
- tray action mapping,
- macOS system proxy command construction/parsing.
